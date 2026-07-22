import { describe, expect, it } from "vitest";
import { extractPdf } from "@/modules/extraction/pdf-engine";
import type { VisionClient } from "@/modules/extraction/vision-client";
import { DEFAULT_CONFIG } from "@/shared/config";
import { buildMinimalPdf, buildBlankPdf } from "./fixtures/pdf-fixture";

describe("Step 1 — Motor de PDF (pdfjs + OCR/Vision)", () => {
  it("extrai texto de página com camada de texto sem chamar a Vision API", async () => {
    let called = false;
    const client: VisionClient = {
      chat: {
        completions: {
          async create() {
            called = true;
            return { choices: [{ message: { content: "{}" } }] };
          },
        },
      },
    };

    const result = await extractPdf(
      buildMinimalPdf("Art. 1 Texto de teste."),
      DEFAULT_CONFIG.ocr,
      client
    );

    expect(result.text).toContain("Art. 1 Texto de teste.");
    expect(result.ocrPages).toEqual([]);
    expect(result.figures).toEqual([]);
    expect(called).toBe(false);
    expect(result.pageOffsets).toHaveLength(1);
  });

  it("usa a Vision API para transcrever páginas sem texto (escaneadas)", async () => {
    const client: VisionClient = {
      chat: {
        completions: {
          async create() {
            return {
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      texto: "Art. 5 Texto reconhecido via OCR.",
                      figuras: [
                        {
                          descricao: "Mapa da zona urbana.",
                          bbox: [10, 10, 60, 60],
                          texto_na_figura: "ZONA A",
                        },
                      ],
                    }),
                  },
                },
              ],
              usage: { prompt_tokens: 100, completion_tokens: 50 },
            };
          },
        },
      },
    };

    const result = await extractPdf(buildBlankPdf(), DEFAULT_CONFIG.ocr, client);

    expect(result.text).toContain("Art. 5 Texto reconhecido via OCR.");
    expect(result.ocrPages).toEqual([1]);
    expect(result.figures).toHaveLength(1);
    expect(result.figures[0].description).toBe("Mapa da zona urbana.");
    expect(result.figures[0].imageBase64.startsWith("data:image/png;base64,")).toBe(
      true
    );
    expect(result.figures[0].width).toBeGreaterThan(0);
    expect(result.figures[0].height).toBeGreaterThan(0);
  });

  it("descarta figuras menores que o tamanho mínimo configurado", async () => {
    const client: VisionClient = {
      chat: {
        completions: {
          async create() {
            return {
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      texto: "Página escaneada.",
                      figuras: [
                        { descricao: "ícone pequeno", bbox: [1, 1, 2, 2], texto_na_figura: "" },
                      ],
                    }),
                  },
                },
              ],
            };
          },
        },
      },
    };

    const result = await extractPdf(
      buildBlankPdf(),
      { ...DEFAULT_CONFIG.ocr, minFigureWidth: 200, minFigureHeight: 200 },
      client
    );

    expect(result.figures).toEqual([]);
  });

  it("não chama a Vision API quando OCR está desabilitado", async () => {
    let called = false;
    const client: VisionClient = {
      chat: {
        completions: {
          async create() {
            called = true;
            return { choices: [{ message: { content: "{}" } }] };
          },
        },
      },
    };

    const result = await extractPdf(
      buildBlankPdf(),
      { ...DEFAULT_CONFIG.ocr, enabled: false },
      client
    );

    expect(called).toBe(false);
    expect(result.figures).toEqual([]);
    expect(result.warnings.some((w) => w.includes("digitalizada"))).toBe(true);
  });

  it("tenta novamente em erro 429 (rate limit) e recupera a página", async () => {
    let calls = 0;
    const client: VisionClient = {
      chat: {
        completions: {
          async create() {
            calls += 1;
            if (calls === 1) {
              const err = new Error(
                "429 Rate limit reached for gpt-4o-mini on tokens per min (TPM). Please try again in 1ms."
              );
              (err as unknown as { status: number }).status = 429;
              throw err;
            }
            return {
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      texto: "Texto recuperado após retry.",
                      figuras: [],
                    }),
                  },
                },
              ],
            };
          },
        },
      },
    };

    const result = await extractPdf(buildBlankPdf(), DEFAULT_CONFIG.ocr, client);

    expect(calls).toBe(2);
    expect(result.text).toContain("Texto recuperado após retry.");
    expect(result.warnings.some((w) => w.includes("Vision API"))).toBe(false);
  });

  it("não tenta novamente em erros que não são de rate limit", async () => {
    let calls = 0;
    const client: VisionClient = {
      chat: {
        completions: {
          async create() {
            calls += 1;
            throw new Error("400 Bad Request: imagem inválida.");
          },
        },
      },
    };

    const result = await extractPdf(buildBlankPdf(), DEFAULT_CONFIG.ocr, client);

    expect(calls).toBe(1);
    expect(result.warnings.some((w) => w.includes("Vision API"))).toBe(true);
  });
});
