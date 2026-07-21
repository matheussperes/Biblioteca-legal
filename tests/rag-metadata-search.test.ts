import { describe, expect, it } from "vitest";
import { metadataFilter } from "@/modules/metadata-search";
import { EMPTY_ENTITIES } from "@/shared/rag-types";
import { makeChunk } from "./fixtures/rag-fixtures";

describe("Fase 2 — Busca por Metadados", () => {
  it("promove chunks cujos metadados combinam com a categoria/entidades", () => {
    const matching = makeChunk({
      chunkId: "match",
      distance: 0.5, // pior similaridade vetorial...
      enrichment: { tema: "Altura", categoria: "urbanístico", palavras_chave: ["altura", "gabarito"] },
    });
    const nonMatching = makeChunk({
      chunkId: "no-match",
      distance: 0.1, // ...porém melhor similaridade vetorial
      enrichment: { tema: "Recuos", categoria: "urbanístico", palavras_chave: ["recuo"] },
    });

    const result = metadataFilter(
      [nonMatching, matching],
      "Altura",
      { ...EMPTY_ENTITIES, altura: ["12 metros"] },
      10
    );

    expect(result[0].chunkId).toBe("match");
    expect(result[0].stage).toBe("METADATA");
    expect(result[0].reason).toContain("Altura");
  });

  it("usa a distância vetorial como critério de desempate", () => {
    const a = makeChunk({ chunkId: "a", distance: 0.2, enrichment: {} });
    const b = makeChunk({ chunkId: "b", distance: 0.1, enrichment: {} });
    const result = metadataFilter([a, b], "Outros", EMPTY_ENTITIES, 10);
    expect(result.map((c) => c.chunkId)).toEqual(["b", "a"]);
  });

  it("respeita o limite topK", () => {
    const chunks = Array.from({ length: 5 }, (_, i) => makeChunk({ chunkId: `c${i}`, distance: i / 10 }));
    const result = metadataFilter(chunks, "Outros", EMPTY_ENTITIES, 2);
    expect(result).toHaveLength(2);
  });
});
