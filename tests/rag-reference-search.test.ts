import { describe, expect, it } from "vitest";
import { extractReferenceCandidates, referenceMatchesDocument } from "@/modules/reference-search";
import { makeChunk } from "./fixtures/rag-fixtures";

describe("Fase 2 — Busca por Referências Cruzadas", () => {
  it("extrai referências do campo de enriquecimento e do texto do chunk", () => {
    const chunk = makeChunk({
      content: "Observado o disposto na Lei Federal nº 10.257, de 10 de julho de 2001.",
      enrichment: { referencias: ["LUOS"] },
    });
    const candidates = extractReferenceCandidates(chunk);
    expect(candidates).toContain("LUOS");
    expect(candidates.some((c) => c.includes("10.257"))).toBe(true);
  });

  it("não duplica candidatos repetidos", () => {
    const chunk = makeChunk({ content: "texto simples", enrichment: { referencias: ["LUOS", "LUOS"] } });
    expect(extractReferenceCandidates(chunk)).toEqual(["LUOS"]);
  });

  it("reconhece o nome de um documento citado por sigla", () => {
    expect(referenceMatchesDocument("observado o disposto na LUOS", "LUOS")).toBe(true);
    expect(referenceMatchesDocument("LUOS", "LUOS - Lei de Uso e Ocupação do Solo")).toBe(true);
  });

  it("reconhece leis citadas por número mesmo com formatação diferente", () => {
    expect(
      referenceMatchesDocument(
        "Lei Federal nº 10.257/2001",
        "Lei Federal nº 10.257, de 10 de julho de 2001 (Estatuto da Cidade)"
      )
    ).toBe(true);
  });

  it("não confunde documentos sem relação nenhuma", () => {
    expect(referenceMatchesDocument("Decreto 999/2010", "Código de Obras Municipal")).toBe(false);
  });
});
