import OpenAI from "openai";
import { EMPTY_ENTITIES, type EntityExtractionResult, type ExtractedEntities } from "@/shared/rag-types";

/** Interface mínima do cliente — permite injetar mock nos testes. */
export interface EntityExtractionClient {
  chat: {
    completions: {
      create(params: {
        model: string;
        temperature: number;
        response_format: { type: "json_object" };
        messages: Array<{ role: "user"; content: string }>;
      }): Promise<{
        choices: Array<{ message: { content: string | null } }>;
      }>;
    };
  };
}

let defaultClient: OpenAI | null = null;

function getClient(): EntityExtractionClient {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada — necessária para extrair entidades.");
  }
  if (!defaultClient) defaultClient = new OpenAI();
  return defaultClient as unknown as EntityExtractionClient;
}

const ENTITY_KEYS = Object.keys(EMPTY_ENTITIES) as Array<keyof ExtractedEntities>;

function buildPrompt(question: string): string {
  return `Extraia as entidades mencionadas na pergunta abaixo, feita sobre legislação urbanística.

Pergunta:
"""
${question}
"""

Responda APENAS com um JSON contendo exatamente estas chaves, cada uma como lista de strings (vazia se não houver menção):
- "cidade": município(s) citado(s)
- "lei": lei(s) citada(s) nominalmente (ex.: "Lei 10.257/2001")
- "artigo": artigo(s) citado(s) (ex.: "Art. 35")
- "tipoObra": tipo de obra (ex.: "construção nova", "reforma", "demolição")
- "tipoImovel": tipo de imóvel (ex.: "residencial", "comercial", "prédio")
- "zona": zona urbanística citada
- "uso": tipo de uso do solo
- "medidas": medidas genéricas citadas
- "altura": alturas citadas (ex.: "12 metros")
- "area": áreas citadas (ex.: "300 m²")
- "coeficiente": coeficientes de aproveitamento citados
- "taxa": taxas citadas (ex.: "taxa de ocupação")
- "recuo": recuos citados
- "documentos": documentos citados (ex.: "alvará", "habite-se")
- "orgaosPublicos": órgãos públicos citados
- "normas": normas técnicas citadas (ex.: "NBR 9050")

Responda apenas com o JSON, sem texto adicional.`;
}

/** Extração de Entidades — identifica cidade, lei, artigo, zona, medidas etc. na pergunta. */
export async function extractEntities(
  question: string,
  model: string,
  client: EntityExtractionClient = getClient()
): Promise<EntityExtractionResult> {
  const prompt = buildPrompt(question);
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  const raw = response.choices[0]?.message?.content ?? "";

  return { entities: parseEntities(raw), prompt, rawResponse: raw, model };
}

function parseEntities(raw: string): ExtractedEntities {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // resposta fora do formato — mantém todas as entidades vazias
  }
  const entities = { ...EMPTY_ENTITIES };
  for (const key of ENTITY_KEYS) {
    const value = parsed[key];
    if (Array.isArray(value)) {
      entities[key] = value.filter((v): v is string => typeof v === "string");
    }
  }
  return entities;
}

/** Achata todas as entidades extraídas em uma única lista de termos — usado na busca por metadados. */
export function flattenEntities(entities: ExtractedEntities): string[] {
  return ENTITY_KEYS.flatMap((key) => entities[key]).filter((v) => v.trim().length > 0);
}
