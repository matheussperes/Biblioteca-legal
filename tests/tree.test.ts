import { describe, expect, it } from "vitest";
import { cleanText } from "@/modules/cleaning";
import { tokenize } from "@/modules/tokenizer";
import { buildTree } from "@/modules/parser";
import { buildStructureJson, flattenArticles } from "@/modules/tree";
import { LEI_EXEMPLO } from "./fixtures/lei-exemplo";

const tree = buildTree(tokenize(cleanText(LEI_EXEMPLO).cleaned));
const structure = buildStructureJson(tree);

describe("Step 5 — Estrutura da Lei", () => {
  it("gera o JSON com título da lei", () => {
    expect(structure.lei.titulo).toContain("LEI Nº 1.234");
  });

  it("estrutura capítulos, seções e artigos", () => {
    expect(structure.lei.capitulos).toHaveLength(2);
    expect(structure.lei.capitulos[1].secoes).toHaveLength(2);
    expect(structure.lei.capitulos[0].artigos).toHaveLength(2);
  });

  it("artigo carrega parágrafos, incisos e alíneas", () => {
    const art4 = structure.lei.capitulos[1].secoes[1].artigos[0];
    expect(art4.numero).toBe("4");
    expect(art4.incisos).toHaveLength(3);
    expect(art4.incisos[0].alineas).toHaveLength(2);
    expect(art4.paragrafos).toHaveLength(1);
  });

  it("flattenArticles devolve os 5 artigos com contexto", () => {
    const flat = flattenArticles(structure);
    expect(flat).toHaveLength(5);
    const art4 = flat.find((a) => a.numero === "4")!;
    expect(art4.chapterLabel).toContain("CAPÍTULO II");
    expect(art4.sectionLabel).toContain("Seção II");
    expect(art4.fullText).toContain("Art. 4");
    expect(art4.fullText).toContain("a) 20%");
  });

  it("fullText preserva a hierarquia em linhas indivisíveis", () => {
    const flat = flattenArticles(structure);
    const art3 = flat.find((a) => a.numero === "3")!;
    const lines = art3.fullText.split("\n");
    expect(lines.some((l) => l.startsWith("§ 1º"))).toBe(true);
    expect(lines.some((l) => l.startsWith("§ 2º"))).toBe(true);
  });
});
