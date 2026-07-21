import { Prisma } from "@prisma/client";
import { prisma } from "@/database/client";
import { classifyQuestion } from "@/modules/classification";
import { extractEntities } from "@/modules/entity-extraction";
import { embedQuestion, vectorSearch } from "@/modules/retrieval";
import { metadataFilter } from "@/modules/metadata-search";
import { findCrossReferences, retrieveCrossReferencedChunks } from "@/modules/reference-search";
import { rerankChunks } from "@/modules/reranker";
import { buildContext, buildPrompt } from "@/modules/prompt-builder";
import { generateAnswer } from "@/modules/generation";
import { reconcileArticles, validateAnswer } from "@/modules/validation";
import { buildEvidences, buildTrace } from "@/modules/citations";
import { ensureConversation, persistExchange } from "@/modules/history";
import { mergeRagConfig, type RagConfig } from "@/shared/rag-config";
import type {
  Evidence,
  ExplainabilityTrace,
  ExtractedEntities,
  GeneratedAnswer,
  GenerationResult,
  QuestionCategory,
} from "@/shared/rag-types";

const RAG_CONFIG_KEY = "rag-config";

export async function getRagConfig(): Promise<RagConfig> {
  const row = await prisma.appSetting.findUnique({ where: { key: RAG_CONFIG_KEY } });
  return mergeRagConfig(row?.value);
}

export async function saveRagConfig(config: RagConfig) {
  await prisma.appSetting.upsert({
    where: { key: RAG_CONFIG_KEY },
    update: { value: config as unknown as Prisma.InputJsonValue },
    create: { key: RAG_CONFIG_KEY, value: config as unknown as Prisma.InputJsonValue },
  });
  return config;
}

function buildInsufficientEvidenceResult(
  prompt: string,
  model: string,
  temperature: number
): GenerationResult {
  return {
    answer: {
      resumoExecutivo:
        "Não há informação suficiente na Base de Conhecimento para responder a esta pergunta com segurança.",
      fundamentacao: "",
      artigosUtilizados: [],
      referenciasCruzadas: [],
      observacoes:
        "Nenhum documento relevante foi recuperado. Verifique se a legislação necessária já foi indexada na Fase 1.",
      nivelConfianca: "BAIXO",
      hasConflict: false,
      conflictDetails: [],
    },
    prompt,
    rawResponse: "",
    model,
    temperature,
    durationMs: 0,
    costUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
}

export interface AskResult {
  conversationId: string;
  questionId: string;
  answerId: string;
  category: QuestionCategory;
  categoryConfidence: number;
  entities: ExtractedEntities;
  answer: GeneratedAnswer;
  evidences: Evidence[];
  warnings: string[];
  insufficientEvidence: boolean;
  trace: ExplainabilityTrace;
  model: string;
  temperature: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  durationMs: number;
}

/**
 * Motor RAG — orquestra o fluxo completo do PRD da Fase 2:
 * Pergunta → Classificação → Entidades → Busca Vetorial → Metadados →
 * Referências Cruzadas → Reranking → Construção do Contexto → LLM →
 * Validação → Resposta (com persistência completa para rastreabilidade).
 */
export async function askQuestion(
  questionText: string,
  conversationId?: string | null
): Promise<AskResult> {
  const start = Date.now();
  const config = await getRagConfig();

  // A conversa só é criada/gravada mais adiante, depois que a geração tiver
  // sucesso — evita "conversas fantasma" quando a pergunta falha cedo
  // (ex.: OPENAI_API_KEY ausente na Classificação).
  const classification = await classifyQuestion(questionText, config.model);
  const extraction = await extractEntities(questionText, config.model);

  const vector = await embedQuestion(questionText);
  const vectorChunks = await vectorSearch(vector, config.topKVector);

  const metadataChunks =
    vectorChunks.length > 0
      ? metadataFilter(vectorChunks, classification.category, extraction.entities, config.topKMetadata)
      : [];

  const refMatches = metadataChunks.length > 0 ? await findCrossReferences(metadataChunks) : [];
  const referenceChunks =
    refMatches.length > 0 ? await retrieveCrossReferencedChunks(refMatches, vector, 2) : [];

  const rerankResult = await rerankChunks(
    questionText,
    metadataChunks,
    config.topFinal,
    config.model,
    config.rerankingEnabled
  );

  const { formatted } = buildContext(rerankResult.chunks, referenceChunks);
  const prompt = buildPrompt(config.prompt, questionText, formatted);

  const hasEvidence = rerankResult.chunks.length > 0 || referenceChunks.length > 0;
  const generation = hasEvidence
    ? await generateAnswer(prompt, config.model, config.temperature, config.maxTokens)
    : buildInsufficientEvidenceResult(prompt, config.model, config.temperature);

  const allChunks = [...rerankResult.chunks, ...referenceChunks];
  const reconciled = reconcileArticles(generation.answer, allChunks);
  const validation = validateAnswer(reconciled, allChunks);
  const evidences = buildEvidences(allChunks);

  const durationMs = Date.now() - start;
  const trace = buildTrace({
    question: questionText,
    category: classification.category,
    categoryConfidence: classification.confidence,
    entities: extraction.entities,
    vectorStage: vectorChunks,
    metadataStage: metadataChunks,
    referenceStage: referenceChunks,
    rerankStage: rerankResult.chunks,
    prompt: generation.prompt,
    rawResponse: generation.rawResponse,
    model: generation.model,
    temperature: generation.temperature,
    promptTokens: generation.inputTokens,
    completionTokens: generation.outputTokens,
    costUsd: generation.costUsd,
    durationMs,
  });

  const conversation = await ensureConversation(conversationId);
  const { question, answer } = await persistExchange({
    conversationId: conversation.id,
    questionText,
    category: classification.category,
    categoryConfidence: classification.confidence,
    entities: extraction.entities,
    classificationPrompt: classification.prompt,
    classificationRaw: classification.rawResponse,
    classificationModel: classification.model,
    entityPrompt: extraction.prompt,
    entityRaw: extraction.rawResponse,
    entityModel: extraction.model,
    vectorStage: vectorChunks,
    metadataStage: metadataChunks,
    referenceStage: referenceChunks,
    rerankStage: rerankResult.chunks,
    rerankPrompt: rerankResult.prompt,
    rerankRaw: rerankResult.rawResponse,
    generationPrompt: generation.prompt,
    generationRaw: generation.rawResponse,
    answer: reconciled,
    model: generation.model,
    temperature: generation.temperature,
    promptTokens: generation.inputTokens,
    completionTokens: generation.outputTokens,
    costUsd: generation.costUsd,
    durationMs,
    insufficientEvidence: validation.insufficientEvidence,
    trace,
  });

  return {
    conversationId: conversation.id,
    questionId: question.id,
    answerId: answer.id,
    category: classification.category,
    categoryConfidence: classification.confidence,
    entities: extraction.entities,
    answer: reconciled,
    evidences,
    warnings: validation.warnings,
    insufficientEvidence: validation.insufficientEvidence,
    trace,
    model: generation.model,
    temperature: generation.temperature,
    promptTokens: generation.inputTokens,
    completionTokens: generation.outputTokens,
    costUsd: generation.costUsd,
    durationMs,
  };
}
