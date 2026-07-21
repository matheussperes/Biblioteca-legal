import { describe, expect, it } from "vitest";
import { classifyQuestion, type ClassificationClient } from "@/modules/classification";

describe("Fase 2 — Classificador de Perguntas", () => {
  it("classifica a pergunta em uma categoria válida", async () => {
    const client: ClassificationClient = {
      chat: {
        completions: {
          async create(params) {
            expect(params.response_format.type).toBe("json_object");
            return {
              choices: [
                { message: { content: JSON.stringify({ categoria: "Altura", confianca: 0.92 }) } },
              ],
            };
          },
        },
      },
    };
    const result = await classifyQuestion("Posso construir um prédio de 15 metros?", "gpt-4o-mini", client);
    expect(result.category).toBe("Altura");
    expect(result.confidence).toBe(0.92);
  });

  it("cai em 'Outros' com confiança 0 quando a categoria retornada é inválida", async () => {
    const client: ClassificationClient = {
      chat: {
        completions: {
          async create() {
            return { choices: [{ message: { content: JSON.stringify({ categoria: "Categoria Inexistente" }) } }] };
          },
        },
      },
    };
    const result = await classifyQuestion("pergunta qualquer", "gpt-4o-mini", client);
    expect(result.category).toBe("Outros");
    expect(result.confidence).toBe(0);
  });

  it("tolera resposta fora do formato JSON", async () => {
    const client: ClassificationClient = {
      chat: { completions: { async create() { return { choices: [{ message: { content: "não é json" } }] }; } } },
    };
    const result = await classifyQuestion("pergunta", "gpt-4o-mini", client);
    expect(result.category).toBe("Outros");
    expect(result.rawResponse).toBe("não é json");
  });
});
