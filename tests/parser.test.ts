import { describe, expect, it } from "vitest";
import { cleanText } from "@/modules/cleaning";
import { tokenize } from "@/modules/tokenizer";
import { buildTree } from "@/modules/parser";
import type { TreeNode } from "@/shared/types";
import { LEI_EXEMPLO } from "./fixtures/lei-exemplo";

const tree = buildTree(tokenize(cleanText(LEI_EXEMPLO).cleaned));

function findAll(node: TreeNode, type: string): TreeNode[] {
  const found: TreeNode[] = [];
  const walk = (n: TreeNode) => {
    if (n.type === type) found.push(n);
    n.children.forEach(walk);
  };
  walk(node);
  return found;
}

describe("Step 4 — Parser", () => {
  it("raiz é DOCUMENT", () => {
    expect(tree.type).toBe("DOCUMENT");
  });

  it("constrói 2 capítulos com títulos", () => {
    const capitulos = findAll(tree, "CAPITULO");
    expect(capitulos).toHaveLength(2);
    expect(capitulos[0].title).toBe("DISPOSIÇÕES GERAIS");
    expect(capitulos[1].title).toBe("DO PARCELAMENTO DO SOLO");
  });

  it("aninha seções dentro do capítulo II", () => {
    const capitulo2 = findAll(tree, "CAPITULO")[1];
    const secoes = capitulo2.children.filter((c) => c.type === "SECAO");
    expect(secoes).toHaveLength(2);
    expect(secoes[1].title).toBe("Dos Requisitos Urbanísticos");
  });

  it("aninha artigos nos lugares corretos", () => {
    const artigos = findAll(tree, "ARTIGO");
    expect(artigos).toHaveLength(5);
    // Art. 1º e 2º no Capítulo I
    const capitulo1 = findAll(tree, "CAPITULO")[0];
    expect(findAll(capitulo1, "ARTIGO").map((a) => a.number)).toEqual(["1", "2"]);
    // Art. 4º e 5º na Seção II (o Art. 5º não abre nova seção)
    const secao2 = findAll(tree, "SECAO")[1];
    expect(findAll(secao2, "ARTIGO").map((a) => a.number)).toEqual(["4", "5"]);
  });

  it("todo artigo tem caput", () => {
    for (const artigo of findAll(tree, "ARTIGO")) {
      const caput = artigo.children.find((c) => c.type === "CAPUT");
      expect(caput, `Art. ${artigo.number} sem caput`).toBeDefined();
      expect(caput!.text!.length).toBeGreaterThan(0);
    }
  });

  it("caput multi-linha é agregado", () => {
    const art1 = findAll(tree, "ARTIGO").find((a) => a.number === "1")!;
    const caput = art1.children.find((c) => c.type === "CAPUT")!;
    expect(caput.text).toContain("normas de ordenamento territorial");
    expect(caput.text).toContain("Lei Federal nº 10.257");
  });

  it("incisos ficam sob o artigo ou parágrafo correto", () => {
    const art2 = findAll(tree, "ARTIGO").find((a) => a.number === "2")!;
    const incisos = art2.children.filter((c) => c.type === "INCISO");
    expect(incisos.map((i) => i.number)).toEqual(["I", "II", "III"]);
  });

  it("alíneas ficam sob o inciso I do Art. 4º", () => {
    const art4 = findAll(tree, "ARTIGO").find((a) => a.number === "4")!;
    const incisoI = art4.children.filter((c) => c.type === "INCISO")[0];
    const alineas = incisoI.children.filter((c) => c.type === "ALINEA");
    expect(alineas.map((a) => a.number)).toEqual(["a", "b"]);
  });

  it("parágrafos do Art. 3º", () => {
    const art3 = findAll(tree, "ARTIGO").find((a) => a.number === "3")!;
    const paragrafos = art3.children.filter((c) => c.type === "PARAGRAFO");
    expect(paragrafos).toHaveLength(2);
    expect(paragrafos[0].label).toBe("§ 1º");
  });

  it("parágrafo único é reconhecido", () => {
    const art4 = findAll(tree, "ARTIGO").find((a) => a.number === "4")!;
    const paragrafos = art4.children.filter((c) => c.type === "PARAGRAFO");
    expect(paragrafos).toHaveLength(1);
    expect(paragrafos[0].label).toBe("Parágrafo único");
  });
});
