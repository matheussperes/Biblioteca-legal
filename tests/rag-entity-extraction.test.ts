import { describe, expect, it } from "vitest";
import { extractEntities, flattenEntities, type EntityExtractionClient } from "@/modules/entity-extraction";
import { EMPTY_ENTITIES } from "@/shared/rag-types";

describe("Fase 2 — Extração de Entidades", () => {
  it("extrai entidades estruturadas da pergunta", async () => {
    const client: EntityExtractionClient = {
      chat: {
        completions: {
          async create() {
            return {
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      altura: ["15 metros"],
                      tipoObra: ["construção nova"],
                      tipoImovel: ["prédio"],
                    }),
                  },
                },
              ],
            };
          },
        },
      },
    };
    const result = await extractEntities("Posso construir um prédio de 15 metros?", "gpt-4o-mini", client);
    expect(result.entities.altura).toEqual(["15 metros"]);
    expect(result.entities.tipoObra).toEqual(["construção nova"]);
    expect(result.entities.cidade).toEqual([]);
  });

  it("ignora chaves desconhecidas e valores não-array", async () => {
    const client: EntityExtractionClient = {
      chat: {
        completions: {
          async create() {
            return {
              choices: [
                { message: { content: JSON.stringify({ altura: "15 metros", campoInvalido: ["x"] }) } },
              ],
            };
          },
        },
      },
    };
    const result = await extractEntities("pergunta", "gpt-4o-mini", client);
    expect(result.entities.altura).toEqual([]); // não é array — descartado
  });

  it("tolera resposta fora do formato JSON retornando entidades vazias", async () => {
    const client: EntityExtractionClient = {
      chat: { completions: { async create() { return { choices: [{ message: { content: "xyz" } }] }; } } },
    };
    const result = await extractEntities("pergunta", "gpt-4o-mini", client);
    expect(result.entities).toEqual(EMPTY_ENTITIES);
  });

  it("flattenEntities achata todas as entidades em uma única lista", () => {
    const flat = flattenEntities({
      ...EMPTY_ENTITIES,
      altura: ["12 metros"],
      zona: ["ZR-2"],
      cidade: [],
    });
    expect(flat).toEqual(["ZR-2", "12 metros"]);
  });
});
