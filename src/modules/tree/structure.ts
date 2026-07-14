import type { TreeNode } from "@/shared/types";

// ---------------------------------------------------------------------------
// Step 5 — Estrutura da Lei.
// Converte a Árvore Estrutural (Step 4) no JSON definitivo da lei e em uma
// lista "achatada" de artigos com contexto, consumida pela Chunkização.
// ---------------------------------------------------------------------------

export interface LawItem {
  numero: string;
  texto: string;
}

export interface LawAlinea {
  letra: string;
  texto: string;
  itens: LawItem[];
}

export interface LawInciso {
  numero: string;
  texto: string;
  alineas: LawAlinea[];
}

export interface LawParagraph {
  rotulo: string;
  texto: string;
  incisos: LawInciso[];
}

export interface LawArticle {
  numero: string;
  rotulo: string;
  caput: string;
  paragrafos: LawParagraph[];
  incisos: LawInciso[];
  observacoes: string[];
  referencias: string[];
}

export interface LawSection {
  rotulo: string;
  titulo?: string;
  subsecao: boolean;
  artigos: LawArticle[];
  subsecoes: LawSection[];
}

export interface LawChapter {
  rotulo: string;
  titulo?: string;
  secoes: LawSection[];
  artigos: LawArticle[];
}

export interface LawStructure {
  lei: {
    titulo: string;
    capitulos: LawChapter[];
    /** artigos fora de qualquer capítulo */
    artigos: LawArticle[];
  };
}

export function buildStructureJson(tree: TreeNode): LawStructure {
  const structure: LawStructure = {
    lei: {
      titulo: tree.title || tree.label || "Documento",
      capitulos: [],
      artigos: [],
    },
  };

  for (const child of tree.children) {
    if (child.type === "CAPITULO") {
      structure.lei.capitulos.push(convertChapter(child));
    } else if (child.type === "ARTIGO") {
      structure.lei.artigos.push(convertArticle(child));
    } else if (child.type === "SECAO" || child.type === "SUBSECAO") {
      // seção sem capítulo — cria capítulo implícito
      let implicit = structure.lei.capitulos.find((c) => c.rotulo === "");
      if (!implicit) {
        implicit = { rotulo: "", titulo: undefined, secoes: [], artigos: [] };
        structure.lei.capitulos.push(implicit);
      }
      implicit.secoes.push(convertSection(child));
    }
  }

  return structure;
}

function convertChapter(node: TreeNode): LawChapter {
  const chapter: LawChapter = {
    rotulo: node.label,
    titulo: node.title,
    secoes: [],
    artigos: [],
  };
  for (const child of node.children) {
    if (child.type === "SECAO" || child.type === "SUBSECAO") {
      chapter.secoes.push(convertSection(child));
    } else if (child.type === "ARTIGO") {
      chapter.artigos.push(convertArticle(child));
    }
  }
  return chapter;
}

function convertSection(node: TreeNode): LawSection {
  const section: LawSection = {
    rotulo: node.label,
    titulo: node.title,
    subsecao: node.type === "SUBSECAO",
    artigos: [],
    subsecoes: [],
  };
  for (const child of node.children) {
    if (child.type === "ARTIGO") {
      section.artigos.push(convertArticle(child));
    } else if (child.type === "SUBSECAO") {
      section.subsecoes.push(convertSection(child));
    }
  }
  return section;
}

function convertArticle(node: TreeNode): LawArticle {
  const article: LawArticle = {
    numero: node.number ?? "",
    rotulo: node.label,
    caput: "",
    paragrafos: [],
    incisos: [],
    observacoes: [],
    referencias: [],
  };
  for (const child of node.children) {
    switch (child.type) {
      case "CAPUT":
        article.caput = child.text ?? "";
        break;
      case "PARAGRAFO":
        article.paragrafos.push(convertParagraph(child));
        break;
      case "INCISO":
        article.incisos.push(convertInciso(child));
        break;
      case "OBSERVACAO":
        article.observacoes.push(child.text ?? "");
        break;
      case "REFERENCIA_LEGAL":
        article.referencias.push(child.text ?? "");
        break;
      case "NOVA_REDACAO":
        article.observacoes.push(`Nova redação: ${child.text ?? ""}`);
        break;
    }
  }
  return article;
}

function convertParagraph(node: TreeNode): LawParagraph {
  return {
    rotulo: node.label,
    texto: node.text ?? "",
    incisos: node.children
      .filter((c) => c.type === "INCISO")
      .map(convertInciso),
  };
}

function convertInciso(node: TreeNode): LawInciso {
  return {
    numero: node.number ?? node.label,
    texto: node.text ?? "",
    alineas: node.children
      .filter((c) => c.type === "ALINEA")
      .map((a) => ({
        letra: a.number ?? a.label,
        texto: a.text ?? "",
        itens: a.children
          .filter((c) => c.type === "ITEM")
          .map((it) => ({ numero: it.number ?? it.label, texto: it.text ?? "" })),
      })),
  };
}

// ---------------------------------------------------------------------------
// Lista achatada de artigos com contexto — insumo da Chunkização (Step 6)
// ---------------------------------------------------------------------------

export interface FlatArticle {
  numero: string;
  rotulo: string;
  chapterLabel?: string;
  sectionLabel?: string;
  article: LawArticle;
  /** texto completo do artigo (caput + parágrafos + incisos + alíneas + itens) */
  fullText: string;
}

export function flattenArticles(structure: LawStructure): FlatArticle[] {
  const result: FlatArticle[] = [];

  const pushArticle = (
    article: LawArticle,
    chapterLabel?: string,
    sectionLabel?: string
  ) => {
    result.push({
      numero: article.numero,
      rotulo: article.rotulo,
      chapterLabel,
      sectionLabel,
      article,
      fullText: articleFullText(article),
    });
  };

  for (const article of structure.lei.artigos) pushArticle(article);

  for (const chapter of structure.lei.capitulos) {
    const chapterLabel = [chapter.rotulo, chapter.titulo]
      .filter(Boolean)
      .join(" — ");
    for (const article of chapter.artigos) pushArticle(article, chapterLabel);
    for (const section of chapter.secoes) {
      walkSection(section, chapterLabel, pushArticle);
    }
  }

  return result;
}

function walkSection(
  section: LawSection,
  chapterLabel: string | undefined,
  pushArticle: (a: LawArticle, c?: string, s?: string) => void
) {
  const sectionLabel = [section.rotulo, section.titulo]
    .filter(Boolean)
    .join(" — ");
  for (const article of section.artigos) {
    pushArticle(article, chapterLabel, sectionLabel);
  }
  for (const sub of section.subsecoes) {
    walkSection(sub, chapterLabel, pushArticle);
  }
}

export function articleFullText(article: LawArticle): string {
  const parts: string[] = [];
  parts.push(`${article.rotulo} ${article.caput}`.trim());
  for (const inciso of article.incisos) parts.push(incisoText(inciso));
  for (const paragraph of article.paragrafos) {
    parts.push(`${paragraph.rotulo} ${paragraph.texto}`.trim());
    for (const inciso of paragraph.incisos) parts.push(incisoText(inciso));
  }
  for (const obs of article.observacoes) parts.push(obs);
  return parts.join("\n");
}

function incisoText(inciso: LawInciso): string {
  const parts = [`${inciso.numero} - ${inciso.texto}`];
  for (const alinea of inciso.alineas) {
    parts.push(`${alinea.letra}) ${alinea.texto}`);
    for (const item of alinea.itens) {
      parts.push(`${item.numero}. ${item.texto}`);
    }
  }
  return parts.join("\n");
}
