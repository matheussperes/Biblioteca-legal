import { describe, expect, it } from "vitest";
import { tokenize } from "@/modules/tokenizer";
import { cleanText } from "@/modules/cleaning";
import { LEI_EXEMPLO } from "./fixtures/lei-exemplo";

const tokens = tokenize(cleanText(LEI_EXEMPLO).cleaned);
const byType = (type: string) => tokens.filter((t) => t.type === type);

describe("Step 3 — Tokenização", () => {
  it("gera o token DOCUMENT como raiz", () => {
    expect(tokens[0].type).toBe("DOCUMENT");
    expect(tokens[0].text).toContain("LEI Nº 1.234");
  });

  it("identifica os capítulos", () => {
    const capitulos = byType("CAPITULO");
    expect(capitulos).toHaveLength(2);
    expect(capitulos[0].text).toMatch(/CAPÍTULO I$/);
  });

  it("identifica os títulos de capítulo", () => {
    const titulos = byType("TITULO_CAPITULO");
    expect(titulos.map((t) => t.text)).toContain("DISPOSIÇÕES GERAIS");
  });

  it("identifica as seções e seus títulos", () => {
    expect(byType("SECAO")).toHaveLength(2);
    expect(byType("TITULO_SECAO").map((t) => t.text)).toContain(
      "Dos Requisitos Urbanísticos"
    );
  });

  it("identifica os 5 artigos", () => {
    const artigos = byType("ARTIGO");
    expect(artigos).toHaveLength(5);
    expect(artigos[0].text).toMatch(/^Art\. 1º/);
  });

  it("identifica parágrafos (§ e parágrafo único)", () => {
    const paragrafos = byType("PARAGRAFO");
    expect(paragrafos).toHaveLength(3);
    expect(paragrafos.some((p) => /Parágrafo único/i.test(p.text))).toBe(true);
  });

  it("identifica incisos com numeração romana", () => {
    const incisos = byType("INCISO");
    expect(incisos.length).toBe(8);
    expect(incisos[0].text).toMatch(/^I - zona urbana/);
  });

  it("identifica alíneas", () => {
    const alineas = byType("ALINEA");
    expect(alineas).toHaveLength(2);
    expect(alineas[0].text).toMatch(/^a\) 20%/);
  });

  it("classifica continuação de artigo como CAPUT", () => {
    const caputs = byType("CAPUT");
    expect(caputs.some((c) => c.text.includes("em conformidade com a Lei Federal"))).toBe(
      true
    );
  });

  it("identifica nova redação (NR)", () => {
    expect(byType("NOVA_REDACAO").length).toBeGreaterThan(0);
  });

  it("identifica referências legais", () => {
    const refs = byType("REFERENCIA_LEGAL");
    expect(refs.some((r) => r.text.includes("10.257"))).toBe(true);
  });

  it("registra linha inicial e final de cada token", () => {
    for (const token of tokens) {
      expect(token.startLine).toBeGreaterThan(0);
      expect(token.endLine).toBeGreaterThanOrEqual(token.startLine);
    }
  });

  it("aceita regex customizado", () => {
    const custom = tokenize("Artículo 1. Teste", {
      capitulo: "^CAP[IÍ]TULO\\s+([IVXLCDM]+)(.*)$",
      secao: "^SE[ÇC][ÃA]O\\s+([IVXLCDM]+)(.*)$",
      subsecao: "^SUBSE[ÇC][ÃA]O\\s+([IVXLCDM]+)(.*)$",
      artigo: "^Art[íi]culo\\s+(\\d+)\\.?\\s*(.*)$",
      paragrafo: "^§\\s*(\\d+)\\s*(.*)$",
      inciso: "^([IVXLCDM]+)\\s*-\\s+(.*)$",
      alinea: "^([a-z])\\)\\s+(.*)$",
      item: "^(\\d+)[.)]\\s+(.*)$",
      observacao: "^Obs\\.?\\s*(.*)$",
      novaRedacao: "\\(NR\\)",
      referenciaLegal: "Lei\\s+n\\s*[ºo.]?\\s*[\\d.]+",
    } as never);
    expect(custom.some((t) => t.type === "ARTIGO")).toBe(true);
  });
});
