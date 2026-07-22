import { Prisma } from "@prisma/client";
import { prisma } from "@/database/client";
import {
  PIPELINE_STEPS,
  STEP_RESULT_STATUS,
  STEP_LABELS,
  type PipelineStep,
  type PipelineStatusValue,
  type StructuralToken,
  type TreeNode,
  type PageOffset,
} from "@/shared/types";
import { mergeConfig, type PipelineConfig } from "@/shared/config";
import { extractText } from "@/modules/extraction";
import { cleanText } from "@/modules/cleaning";
import { tokenize } from "@/modules/tokenizer";
import { buildTree } from "@/modules/parser";
import {
  buildStructureJson,
  flattenArticles,
  type LawStructure,
} from "@/modules/tree";
import { chunkArticles } from "@/modules/chunking";
import { enrichText } from "@/modules/enrichment";
import { generateEmbeddings } from "@/modules/embeddings";
import { storeVector, indexDocument } from "@/modules/vector-index";
import { locateArticlePages, assignFiguresToArticles } from "./figure-linking";

// ---------------------------------------------------------------------------
// Pipeline Engine.
// Orquestra os steps de forma desacoplada: cada step lê o artefato persistido
// pelo anterior e grava o seu próprio. Qualquer step pode ser reexecutado —
// os artefatos posteriores são invalidados e o status volta ao ponto refeito.
// ---------------------------------------------------------------------------

const CONFIG_KEY = "pipeline-config";

export async function getPipelineConfig(): Promise<PipelineConfig> {
  const row = await prisma.appSetting.findUnique({ where: { key: CONFIG_KEY } });
  return mergeConfig(row?.value);
}

export async function savePipelineConfig(config: PipelineConfig) {
  await prisma.appSetting.upsert({
    where: { key: CONFIG_KEY },
    update: { value: config as unknown as Prisma.InputJsonValue },
    create: { key: CONFIG_KEY, value: config as unknown as Prisma.InputJsonValue },
  });
}

/** Status mínimo exigido para executar cada step. */
const STEP_PREREQUISITE: Record<PipelineStep, PipelineStatusValue> = {
  EXTRACTION: "UPLOADED",
  CLEANING: "EXTRACTED",
  TOKENIZATION: "CLEANED",
  PARSING: "TOKENIZED",
  TREE: "PARSED",
  CHUNKING: "TREE_CREATED",
  ENRICHMENT: "CHUNKED",
  EMBEDDINGS: "ENRICHED",
  INDEXING: "EMBEDDED",
};

const STATUS_ORDER: PipelineStatusValue[] = [
  "UPLOADED",
  "EXTRACTED",
  "CLEANED",
  "TOKENIZED",
  "PARSED",
  "TREE_CREATED",
  "CHUNKED",
  "ENRICHED",
  "EMBEDDED",
  "INDEXED",
];

function statusIndex(status: string): number {
  return STATUS_ORDER.indexOf(status as PipelineStatusValue);
}

async function log(
  documentId: string,
  step: string,
  message: string,
  level: "info" | "warn" | "error" = "info",
  meta?: Record<string, unknown>
) {
  await prisma.pipelineLog.create({
    data: {
      documentId,
      step,
      level,
      message,
      meta: meta ? (meta as Prisma.InputJsonValue) : undefined,
    },
  });
}

/**
 * Executa um step do pipeline para um documento.
 * Cria um ProcessingJob, valida pré-requisitos, executa, grava artefatos,
 * atualiza o status e registra logs — inclusive em caso de erro.
 */
export async function runStep(documentId: string, step: PipelineStep) {
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
  });

  const prerequisite = STEP_PREREQUISITE[step];
  if (statusIndex(document.status) < statusIndex(prerequisite)) {
    throw new Error(
      `Step ${STEP_LABELS[step]} requer status ${prerequisite}, mas o documento está em ${document.status}. Execute os steps anteriores primeiro.`
    );
  }

  const job = await prisma.processingJob.create({
    data: { documentId, step, status: "RUNNING", startedAt: new Date() },
  });
  await log(documentId, step, `${STEP_LABELS[step]} iniciado.`);

  const config = await getPipelineConfig();

  try {
    const meta = await executeStep(documentId, step, config);

    // Alguns steps processam em lotes (ex.: Enriquecimento IA, para caber no
    // limite de execução da função serverless) e sinalizam `concluido: false`
    // quando ainda restam itens — nesse caso o status do documento não avança,
    // para que o pipeline não libere o próximo step antes da hora e para que
    // a UI saiba reexecutar este mesmo step para continuar.
    const partial = (meta as { concluido?: boolean }).concluido === false;

    if (!partial) {
      // Reprocessamento: se o documento estava além deste step, o status
      // retrocede para o resultado do step refeito (artefatos posteriores
      // já foram invalidados por executeStep).
      await prisma.document.update({
        where: { id: documentId },
        data: { status: STEP_RESULT_STATUS[step] },
      });
    }

    await prisma.processingJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        meta: meta as Prisma.InputJsonValue,
      },
    });
    await log(
      documentId,
      step,
      partial
        ? `${STEP_LABELS[step]} — lote concluído, execução parcial.`
        : `${STEP_LABELS[step]} concluído.`,
      "info",
      meta
    );

    return { ok: true as const, step, meta, partial };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.processingJob.update({
      where: { id: job.id },
      data: { status: "FAILED", finishedAt: new Date(), error: message },
    });
    await log(documentId, step, `${STEP_LABELS[step]} falhou: ${message}`, "error");
    throw error;
  }
}

/**
 * Executa todos os steps a partir de `from` (inclusive) até o fim.
 * Para na hora se um step retornar execução parcial (lote) — o status do
 * documento não avançou, então reexecutar a cascata depois retoma daqui.
 */
export async function runPipelineFrom(documentId: string, from: PipelineStep) {
  const startIndex = PIPELINE_STEPS.indexOf(from);
  const results = [];
  for (const step of PIPELINE_STEPS.slice(startIndex)) {
    const result = await runStep(documentId, step);
    results.push(result);
    if (result.partial) break;
  }
  return results;
}

// ---------------------------------------------------------------------------
// Implementação de cada step
// ---------------------------------------------------------------------------

async function executeStep(
  documentId: string,
  step: PipelineStep,
  config: PipelineConfig
): Promise<Record<string, unknown>> {
  switch (step) {
    case "EXTRACTION":
      return stepExtraction(documentId, config);
    case "CLEANING":
      return stepCleaning(documentId);
    case "TOKENIZATION":
      return stepTokenization(documentId, config);
    case "PARSING":
      return stepParsing(documentId, config);
    case "TREE":
      return stepTree(documentId);
    case "CHUNKING":
      return stepChunking(documentId, config);
    case "ENRICHMENT":
      return stepEnrichment(documentId, config);
    case "EMBEDDINGS":
      return stepEmbeddings(documentId, config);
    case "INDEXING":
      return stepIndexing(documentId);
  }
}

async function stepExtraction(documentId: string, config: PipelineConfig) {
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
  });
  const result = await extractText(
    {
      type: document.type,
      buffer: document.originalContent
        ? Buffer.from(document.originalContent)
        : undefined,
      pastedText: document.pastedText ?? undefined,
    },
    config.ocr
  );

  await prisma.document.update({
    where: { id: documentId },
    data: {
      extractedText: result.text,
      extractionMeta: result.meta as unknown as Prisma.InputJsonValue,
      // invalida artefatos posteriores
      cleanedText: null,
      structureJson: Prisma.DbNull,
    },
  });
  await invalidateFrom(documentId, "TOKENIZATION");

  // Etapa 2 — figuras extraídas via OCR/Vision (regravadas a cada execução do step)
  await prisma.documentFigure.deleteMany({ where: { documentId } });
  const figures = result.figures ?? [];
  if (figures.length > 0) {
    await prisma.documentFigure.createMany({
      data: figures.map((f) => ({
        documentId,
        page: f.page,
        index: f.index,
        imageBase64: f.imageBase64,
        width: f.width,
        height: f.height,
        description: f.description || null,
        ocrText: f.ocrText || null,
      })),
    });
  }

  for (const warning of result.meta.warnings ?? []) {
    await log(documentId, "EXTRACTION", warning, "warn");
  }
  if (figures.length > 0) {
    await log(
      documentId,
      "EXTRACTION",
      `${figures.length} figura(s) detectada(s) e recortada(s) via Vision API.`
    );
  }

  return {
    caracteres: result.text.length,
    paginas: result.meta.pages,
    engine: result.meta.engine,
    duracao_ms: result.meta.durationMs,
    figuras_detectadas: figures.length,
    paginas_ocr: result.meta.ocrPages?.length ?? 0,
  };
}

async function stepCleaning(documentId: string) {
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
  });
  if (document.extractedText == null) {
    throw new Error("Texto extraído não encontrado — execute a Extração.");
  }
  const result = cleanText(document.extractedText);

  await prisma.document.update({
    where: { id: documentId },
    data: {
      cleanedText: result.cleaned,
      cleaningStats: result.stats as unknown as Prisma.InputJsonValue,
    },
  });
  await invalidateFrom(documentId, "TOKENIZATION");

  return {
    caracteres_antes: result.stats.charsBefore,
    caracteres_depois: result.stats.charsAfter,
    linhas_antes: result.stats.linesBefore,
    linhas_depois: result.stats.linesAfter,
  };
}

async function stepTokenization(documentId: string, config: PipelineConfig) {
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
  });
  if (document.cleanedText == null) {
    throw new Error("Texto limpo não encontrado — execute a Limpeza.");
  }

  const tokens = tokenize(document.cleanedText, config.regex);

  await prisma.token.deleteMany({ where: { documentId } });
  await prisma.token.createMany({
    data: tokens.map((t) => ({
      documentId,
      index: t.index,
      type: t.type,
      text: t.text,
      position: t.position,
      startLine: t.startLine,
      endLine: t.endLine,
    })),
  });
  await invalidateFrom(documentId, "PARSING");

  const byType: Record<string, number> = {};
  for (const t of tokens) byType[t.type] = (byType[t.type] ?? 0) + 1;

  await log(
    documentId,
    "TOKENIZATION",
    `${tokens.length} tokens gerados (${byType["ARTIGO"] ?? 0} artigos, ${byType["INCISO"] ?? 0} incisos, ${byType["PARAGRAFO"] ?? 0} parágrafos).`
  );

  return { total: tokens.length, por_tipo: byType };
}

async function loadTokens(documentId: string): Promise<StructuralToken[]> {
  const rows = await prisma.token.findMany({
    where: { documentId },
    orderBy: { index: "asc" },
  });
  if (rows.length === 0) {
    throw new Error("Tokens não encontrados — execute a Tokenização.");
  }
  return rows.map((r) => ({
    id: r.id,
    index: r.index,
    type: r.type as StructuralToken["type"],
    text: r.text,
    position: r.position,
    startLine: r.startLine,
    endLine: r.endLine,
  }));
}

async function stepParsing(documentId: string, config: PipelineConfig) {
  const tokens = await loadTokens(documentId);
  const tree = buildTree(tokens, config.regex);

  // A árvore do parser é persistida como artefato no documento; o Step 5
  // (Estrutura) a consome para gerar o JSON definitivo e as tabelas relacionais.
  await prisma.document.update({
    where: { id: documentId },
    data: {
      structureJson: {
        parserTree: tree,
      } as unknown as Prisma.InputJsonValue,
    },
  });
  await invalidateFrom(documentId, "TREE");

  const counts = countNodes(tree);
  for (const [type, count] of Object.entries(counts)) {
    if (["CAPITULO", "ARTIGO"].includes(type)) {
      await log(documentId, "PARSING", `${count} nó(s) do tipo ${type} identificado(s).`);
    }
  }

  return { nos: counts };
}

function countNodes(tree: TreeNode): Record<string, number> {
  const counts: Record<string, number> = {};
  const walk = (node: TreeNode) => {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
    node.children.forEach(walk);
  };
  walk(tree);
  return counts;
}

async function stepTree(documentId: string) {
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
  });
  const stored = document.structureJson as { parserTree?: TreeNode } | null;
  if (!stored?.parserTree) {
    throw new Error("Árvore do parser não encontrada — execute o Parser.");
  }

  const tree = stored.parserTree;
  const structure = buildStructureJson(tree);

  // Persistência relacional: capítulos, seções, artigos, parágrafos,
  // incisos e alíneas (invalida e regrava)
  await clearStructure(documentId);

  let chapterIndex = 0;
  let sectionIndex = 0;
  let articleIndex = 0;

  const flat = flattenArticles(structure);
  const chapterIds = new Map<string, string>();
  const sectionIds = new Map<string, string>();

  for (const chapter of structure.lei.capitulos) {
    const created = await prisma.chapter.create({
      data: {
        documentId,
        index: chapterIndex++,
        label: chapter.rotulo || "(sem capítulo)",
        title: chapter.titulo,
      },
    });
    const chapterKey = [chapter.rotulo, chapter.titulo].filter(Boolean).join(" — ");
    chapterIds.set(chapterKey, created.id);

    const walkSections = async (
      sections: typeof chapter.secoes,
      parentChapterId: string
    ) => {
      for (const section of sections) {
        const s = await prisma.section.create({
          data: {
            documentId,
            chapterId: parentChapterId,
            index: sectionIndex++,
            label: section.rotulo,
            title: section.titulo,
            isSubsection: section.subsecao,
          },
        });
        const sectionKey = [section.rotulo, section.titulo]
          .filter(Boolean)
          .join(" — ");
        sectionIds.set(sectionKey, s.id);
        await walkSections(section.subsecoes, parentChapterId);
      }
    };
    await walkSections(chapter.secoes, created.id);
  }

  for (const flatArticle of flat) {
    const article = flatArticle.article;
    const createdArticle = await prisma.article.create({
      data: {
        documentId,
        chapterId: flatArticle.chapterLabel
          ? chapterIds.get(flatArticle.chapterLabel) ?? null
          : null,
        sectionId: flatArticle.sectionLabel
          ? sectionIds.get(flatArticle.sectionLabel) ?? null
          : null,
        index: articleIndex++,
        number: article.numero,
        label: article.rotulo,
        caput: article.caput,
        fullText: flatArticle.fullText,
      },
    });

    let paragraphIndex = 0;
    let incisoIndex = 0;

    const createIncisos = async (
      incisos: typeof article.incisos,
      paragraphId: string | null
    ) => {
      for (const inciso of incisos) {
        const createdInciso = await prisma.inciso.create({
          data: {
            documentId,
            articleId: paragraphId ? null : createdArticle.id,
            paragraphId,
            index: incisoIndex++,
            label: inciso.numero,
            text: inciso.texto,
          },
        });
        let alineaIndex = 0;
        for (const alinea of inciso.alineas) {
          await prisma.alinea.create({
            data: {
              documentId,
              incisoId: createdInciso.id,
              index: alineaIndex++,
              label: alinea.letra,
              text: alinea.texto,
              items:
                alinea.itens.length > 0
                  ? (alinea.itens as unknown as Prisma.InputJsonValue)
                  : undefined,
            },
          });
        }
      }
    };

    await createIncisos(article.incisos, null);
    for (const paragraph of article.paragrafos) {
      const createdParagraph = await prisma.paragraph.create({
        data: {
          documentId,
          articleId: createdArticle.id,
          index: paragraphIndex++,
          label: paragraph.rotulo,
          text: paragraph.texto,
        },
      });
      await createIncisos(paragraph.incisos, createdParagraph.id);
    }

    await log(documentId, "TREE", `${article.rotulo} estruturado.`);
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      structureJson: {
        parserTree: tree,
        structure,
      } as unknown as Prisma.InputJsonValue,
    },
  });
  await invalidateFrom(documentId, "CHUNKING");

  return {
    capitulos: structure.lei.capitulos.length,
    artigos: flat.length,
  };
}

async function stepChunking(documentId: string, config: PipelineConfig) {
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
  });
  const stored = document.structureJson as {
    structure?: LawStructure;
    parserTree?: TreeNode;
  } | null;
  if (!stored?.structure) {
    throw new Error("Estrutura da lei não encontrada — execute o step Estrutura.");
  }

  const flat = flattenArticles(stored.structure);
  const drafts = chunkArticles(
    stored.structure.lei.titulo,
    flat,
    config.chunking
  );

  const articles = await prisma.article.findMany({
    where: { documentId },
    orderBy: { index: "asc" },
    select: { id: true, number: true },
  });
  const articleIdByNumber = new Map(articles.map((a) => [a.number, a.id]));

  await prisma.chunk.deleteMany({ where: { documentId } });
  for (const draft of drafts) {
    await prisma.chunk.create({
      data: {
        documentId,
        articleId: draft.articleRef
          ? articleIdByNumber.get(draft.articleRef) ?? null
          : null,
        index: draft.index,
        content: draft.content,
        tokenCount: draft.tokenCount,
        charCount: draft.charCount,
        part: draft.part,
        totalParts: draft.totalParts,
        originArticle: draft.originArticle,
        originChapter: draft.originChapter,
        originSection: draft.originSection,
      },
    });
  }
  await invalidateFrom(documentId, "EMBEDDINGS");

  const figuresLinked = await linkFiguresToArticles(documentId, document, articles);

  await log(documentId, "CHUNKING", `${drafts.length} chunks criados.`);
  if (figuresLinked > 0) {
    await log(
      documentId,
      "CHUNKING",
      `${figuresLinked} figura(s) vinculada(s) ao artigo/chunk da mesma página.`
    );
  }
  return {
    chunks: drafts.length,
    max_tokens: config.chunking.maxTokens,
    estrategia: config.chunking.strategy,
    figuras_vinculadas: figuresLinked,
  };
}

/**
 * Etapa 2/3 — vincula as figuras extraídas no Step 1 ao artigo (e ao seu
 * primeiro chunk) cuja página de origem coincide com a da figura.
 */
async function linkFiguresToArticles(
  documentId: string,
  document: { extractedText: string | null; extractionMeta: Prisma.JsonValue },
  articles: Array<{ id: string; number: string }>
): Promise<number> {
  const pageOffsets =
    (document.extractionMeta as { pageOffsets?: PageOffset[] } | null)?.pageOffsets ?? [];
  if (!document.extractedText || pageOffsets.length === 0) return 0;

  const figures = await prisma.documentFigure.findMany({
    where: { documentId },
    select: { id: true, page: true },
  });
  if (figures.length === 0) return 0;

  const articleLocations = locateArticlePages(
    document.extractedText,
    articles.map((a) => ({ articleId: a.id, number: a.number })),
    pageOffsets
  );
  const assignment = assignFiguresToArticles(figures, articleLocations);

  const firstPartChunks = await prisma.chunk.findMany({
    where: { documentId, part: 1, articleId: { not: null } },
    select: { id: true, articleId: true },
  });
  const chunkByArticle = new Map(
    firstPartChunks.map((c) => [c.articleId as string, c.id])
  );

  let linked = 0;
  for (const figure of figures) {
    const articleId = assignment.get(figure.id) ?? null;
    await prisma.documentFigure.update({
      where: { id: figure.id },
      data: {
        articleId,
        chunkId: articleId ? chunkByArticle.get(articleId) ?? null : null,
      },
    });
    if (articleId) linked += 1;
  }
  return linked;
}

/**
 * Orçamento de tempo por invocação — deixa margem sob o limite de execução
 * da função serverless (maxDuration=300s na rota). Quando o orçamento é
 * atingido, o step para de forma controlada e sinaliza `concluido: false`;
 * `runStep` mantém o status do documento inalterado até o lote final.
 */
const ENRICHMENT_TIME_BUDGET_MS = 45_000;

async function stepEnrichment(documentId: string, config: PipelineConfig) {
  const chunks = await prisma.chunk.findMany({
    where: { documentId },
    orderBy: { index: "asc" },
  });
  if (chunks.length === 0) {
    throw new Error("Chunks não encontrados — execute a Chunkização.");
  }

  // Retomável: só reprocessa chunks sem enriquecimento ou enriquecidos com
  // um modelo diferente do configurado — evita reprocessar (e recobrar) o
  // que já foi feito em lotes anteriores.
  const pending = chunks.filter(
    (c) => !c.enrichment || c.enrichmentModel !== config.enrichment.model
  );

  const start = Date.now();
  let enriched = 0;
  let totalCost = 0;
  let truncated = false;

  for (const chunk of pending) {
    if (Date.now() - start > ENRICHMENT_TIME_BUDGET_MS) {
      truncated = true;
      break;
    }
    const contexto = [chunk.originChapter, chunk.originSection, chunk.originArticle]
      .filter(Boolean)
      .join(" > ");
    const result = await enrichText(chunk.content, contexto, config.enrichment);

    await prisma.chunk.update({
      where: { id: chunk.id },
      data: {
        enrichment: result.data as unknown as Prisma.InputJsonValue,
        enrichmentPrompt: result.prompt,
        enrichmentResponse: result.rawResponse,
        enrichmentModel: result.model,
        enrichmentDurationMs: result.durationMs,
        enrichmentCostUsd: result.costUsd,
      },
    });
    enriched += 1;
    totalCost += result.costUsd;
    await log(
      documentId,
      "ENRICHMENT",
      `Chunk ${chunk.index + 1}/${chunks.length} (${chunk.originArticle ?? "sem artigo"}) enriquecido em ${result.durationMs} ms.`
    );
  }

  const remaining = pending.length - enriched;
  const concluido = remaining === 0;
  if (!concluido) {
    await log(
      documentId,
      "ENRICHMENT",
      `Lote parcial: ${enriched} chunk(s) processado(s) neste lote (orçamento de tempo${truncated ? " atingido" : ""}), ${remaining} restante(s) — execute novamente para continuar.`,
      "warn"
    );
  }

  return {
    chunks_enriquecidos: enriched,
    chunks_ja_prontos: chunks.length - pending.length,
    chunks_restantes: remaining,
    modelo: config.enrichment.model,
    custo_estimado_usd: Number(totalCost.toFixed(6)),
    concluido,
  };
}

async function stepEmbeddings(documentId: string, config: PipelineConfig) {
  const chunks = await prisma.chunk.findMany({
    where: { documentId },
    orderBy: { index: "asc" },
    include: { embedding: true },
  });
  if (chunks.length === 0) {
    throw new Error("Chunks não encontrados — execute a Chunkização.");
  }

  // Regenera apenas chunks sem embedding ou com conteúdo alterado (hash)
  const { sha256 } = await import("@/shared/utils");
  const pending = chunks.filter(
    (c) =>
      !c.embedding ||
      c.embedding.hash !== sha256(c.content) ||
      c.embedding.model !== config.embeddings.model
  );

  const results = await generateEmbeddings(
    pending.map((c) => c.content),
    config.embeddings
  );

  for (let i = 0; i < pending.length; i++) {
    const chunk = pending[i];
    const result = results[i];
    const embedding = await prisma.embedding.upsert({
      where: { chunkId: chunk.id },
      update: {
        model: result.model,
        dimension: result.dimension,
        hash: result.hash,
        durationMs: result.durationMs,
        indexed: false,
        indexedAt: null,
      },
      create: {
        documentId,
        chunkId: chunk.id,
        model: result.model,
        dimension: result.dimension,
        hash: result.hash,
        durationMs: result.durationMs,
      },
    });
    await storeVector(embedding.id, result.vector);
    await log(
      documentId,
      "EMBEDDINGS",
      `Embedding gerado para o chunk ${chunk.index + 1} (${result.dimension} dimensões).`
    );
  }

  return {
    gerados: pending.length,
    reaproveitados: chunks.length - pending.length,
    modelo: config.embeddings.model,
    dimensao: config.embeddings.dimension,
  };
}

async function stepIndexing(documentId: string) {
  const result = await indexDocument(documentId);
  for (const error of result.errors) {
    await log(documentId, "INDEXING", error, "error");
  }
  await log(
    documentId,
    "INDEXING",
    `${result.indexed} chunk(s) indexado(s) no banco vetorial em ${result.durationMs} ms.`
  );
  return {
    indexados: result.indexed,
    erros: result.errors.length,
    duracao_ms: result.durationMs,
  };
}

// ---------------------------------------------------------------------------
// Invalidação de artefatos posteriores (reprocessamento incremental)
// ---------------------------------------------------------------------------

async function clearStructure(documentId: string) {
  await prisma.alinea.deleteMany({ where: { documentId } });
  await prisma.inciso.deleteMany({ where: { documentId } });
  await prisma.paragraph.deleteMany({ where: { documentId } });
  await prisma.article.deleteMany({ where: { documentId } });
  await prisma.section.deleteMany({ where: { documentId } });
  await prisma.chapter.deleteMany({ where: { documentId } });
}

/** Remove artefatos do step indicado em diante. */
async function invalidateFrom(documentId: string, from: PipelineStep) {
  const order = PIPELINE_STEPS.indexOf(from);
  if (order <= PIPELINE_STEPS.indexOf("TOKENIZATION")) {
    await prisma.token.deleteMany({ where: { documentId } });
  }
  if (order <= PIPELINE_STEPS.indexOf("TREE")) {
    await clearStructure(documentId);
  }
  if (order <= PIPELINE_STEPS.indexOf("CHUNKING")) {
    await prisma.chunk.deleteMany({ where: { documentId } });
  }
  if (order <= PIPELINE_STEPS.indexOf("EMBEDDINGS")) {
    await prisma.embedding.deleteMany({ where: { documentId } });
  }
}
