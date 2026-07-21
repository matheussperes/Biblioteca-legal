import OpenAI from "openai";
import { QUESTION_CATEGORIES, type ClassificationResult, type QuestionCategory } from "@/shared/rag-types";

/** Interface mínima do cliente — permite injetar mock nos testes. */
export interface ClassificationClient {
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

function getClient(): ClassificationClient {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada — necessária para classificar a pergunta.");
  }
  if (!defaultClient) defaultClient = new OpenAI();
  return defaultClient as unknown as ClassificationClient;
}

function buildPrompt(question: string): string {
  return `Classifique a pergunta abaixo, feita por um usuário sobre legislação urbanística, em EXATAMENTE uma das categorias a seguir:

${QUESTION_CATEGORIES.map((c) => `- ${c}`).join("\n")}

Pergunta:
"""
${question}
"""

Responda APENAS com um JSON no formato:
{ "categoria": "<uma das categorias acima, exatamente como escrita>", "confianca": <número entre 0 e 1> }`;
}

/**
 * Classificador de Perguntas — executado antes de consultar o banco.
 * A classificação é usada para melhorar a recuperação (busca por metadados).
 */
export async function classifyQuestion(
  question: string,
  model: string,
  client: ClassificationClient = getClient()
): Promise<ClassificationResult> {
  const prompt = buildPrompt(question);
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  const raw = response.choices[0]?.message?.content ?? "";

  let category: QuestionCategory = "Outros";
  let confidence = 0;
  try {
    const parsed = JSON.parse(raw) as { categoria?: unknown; confianca?: unknown };
    if (
      typeof parsed.categoria === "string" &&
      (QUESTION_CATEGORIES as readonly string[]).includes(parsed.categoria)
    ) {
      category = parsed.categoria as QuestionCategory;
    }
    if (typeof parsed.confianca === "number" && Number.isFinite(parsed.confianca)) {
      confidence = Math.min(1, Math.max(0, parsed.confianca));
    }
  } catch {
    // resposta fora do formato — mantém categoria "Outros" com confiança 0
  }

  return { category, confidence, prompt, rawResponse: raw, model };
}
