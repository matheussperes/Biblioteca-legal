import { describe, expect, it } from "vitest";
import {
  locateArticlePages,
  assignFiguresToArticles,
} from "@/modules/pipeline/figure-linking";
import type { PageOffset } from "@/shared/types";

describe("Step 6 — vínculo de figuras a artigo/chunk pela página", () => {
  const page1 = "Art. 1 Disposição inicial.";
  const page2 = "Art. 2 Zoneamento urbano conforme mapa anexo.";
  const page3 = "Art. 3 Recuos e alinhamentos.";
  const text = [page1, page2, page3].join("\n\n");

  const pageOffsets: PageOffset[] = [
    { page: 1, start: 0, end: page1.length },
    { page: 2, start: page1.length + 2, end: page1.length + 2 + page2.length },
    {
      page: 3,
      start: page1.length + 2 + page2.length + 2,
      end: text.length,
    },
  ];

  it("localiza a página de cada artigo pela primeira ocorrência no texto", () => {
    const locations = locateArticlePages(
      text,
      [
        { articleId: "a1", number: "1" },
        { articleId: "a2", number: "2" },
        { articleId: "a3", number: "3" },
      ],
      pageOffsets
    );

    expect(locations).toEqual([
      { articleId: "a1", page: 1 },
      { articleId: "a2", page: 2 },
      { articleId: "a3", page: 3 },
    ]);
  });

  it("não confunde artigos com números repetidos — busca sempre a partir da última ocorrência", () => {
    const repeated = "Art. 1 Primeiro.\n\nArt. 1-A Complementar.\n\nArt. 1 Segundo (erro de digitação).";
    const locations = locateArticlePages(
      repeated,
      [
        { articleId: "a1", number: "1" },
        { articleId: "a1a", number: "1-A" },
      ],
      [{ page: 1, start: 0, end: repeated.length }]
    );
    expect(locations[0].page).toBe(1);
    expect(locations[1].page).toBe(1);
  });

  it("vincula a figura ao último artigo cuja página é <= à página da figura", () => {
    const locations = locateArticlePages(
      text,
      [
        { articleId: "a1", number: "1" },
        { articleId: "a2", number: "2" },
        { articleId: "a3", number: "3" },
      ],
      pageOffsets
    );

    const assignment = assignFiguresToArticles(
      [
        { id: "fig-p2", page: 2 },
        { id: "fig-p3", page: 3 },
      ],
      locations
    );

    expect(assignment.get("fig-p2")).toBe("a2");
    expect(assignment.get("fig-p3")).toBe("a3");
  });

  it("deixa figuras anteriores ao primeiro artigo sem vínculo", () => {
    const locations = locateArticlePages(
      text,
      [{ articleId: "a1", number: "1" }],
      [{ page: 1, start: 5, end: text.length }] // artigo só aparece a partir do offset 5+
    );

    const assignment = assignFiguresToArticles([{ id: "fig-capa", page: 1 }], [
      { articleId: "a1", page: null },
    ]);

    expect(assignment.get("fig-capa")).toBeNull();
    expect(locations).toBeDefined();
  });
});
