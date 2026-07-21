import { describe, expect, it } from "vitest";
import { generateAnswer, type GenerationClient } from "@/modules/generation";

const validPayload = {
  resumo_executivo: "Sim, é permitido construir até 12 metros nesta zona.",
  fundamentacao: "Conforme o Art. 10 da LUOS, a altura máxima é 12 metros.",
  artigos_utilizados: [
    { lei: "LUOS", capitulo: "CAPÍTULO II", secao: null, artigo: "Art. 10", trecho: "altura máxima de 12 metros" },
  ],
  referencias_cruzadas: [{ lei: "Código de Obras", artigo: "Art. 5", motivo: "trata do mesmo tema" }],
  observacoes: "",
  nivel_confianca: "ALTO",
  has_conflict: false,
  conflict_details: [],
};

describe("Fase 2 — Geração da Resposta", () => {
  it("retorna a resposta estruturada a partir do JSON do LLM", async () => {
    const client: GenerationClient = {
      chat: {
        completions: {
          async create(params) {
            expect(params.response_format.type).toBe("json_object");
            return {
              choices: [{ message: { content: JSON.stringify(validPayload) } }],
              usage: { prompt_tokens: 800, completion_tokens: 200 },
            };
          },
        },
      },
    };
    const result = await generateAnswer("prompt final", "gpt-4o-mini", 0, 2048, client);
    expect(result.answer.nivelConfianca).toBe("ALTO");
    expect(result.answer.artigosUtilizados).toHaveLength(1);
    expect(result.answer.artigosUtilizados[0].artigo).toBe("Art. 10");
    expect(result.answer.referenciasCruzadas[0].lei).toBe("Código de Obras");
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it("identifica divergências entre normas quando has_conflict é true", async () => {
    const client: GenerationClient = {
      chat: {
        completions: {
          async create() {
            return {
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      ...validPayload,
                      has_conflict: true,
                      conflict_details: [
                        {
                          tema: "Altura máxima",
                          versoes: [
                            { lei: "Lei A", artigo: "Art. 10", valor: "12 metros" },
                            { lei: "Lei B", artigo: "Art. 8", valor: "10 metros" },
                          ],
                        },
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
    const result = await generateAnswer("prompt", "gpt-4o-mini", 0, 2048, client);
    expect(result.answer.hasConflict).toBe(true);
    expect(result.answer.conflictDetails[0].versoes).toHaveLength(2);
  });

  it("cai em nível de confiança BAIXO quando a resposta não é um JSON válido", async () => {
    const client: GenerationClient = {
      chat: { completions: { async create() { return { choices: [{ message: { content: "resposta livre" } }] }; } } },
    };
    const result = await generateAnswer("prompt", "gpt-4o-mini", 0, 2048, client);
    expect(result.answer.nivelConfianca).toBe("BAIXO");
    expect(result.answer.artigosUtilizados).toEqual([]);
  });
});
