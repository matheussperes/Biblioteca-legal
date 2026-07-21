import OpenAI from "openai";

/** Interface mínima do cliente de visão — permite injetar mock nos testes. */
export interface VisionClient {
  chat: {
    completions: {
      create(params: {
        model: string;
        temperature: number;
        response_format: { type: "json_object" };
        messages: Array<{
          role: "user";
          content: Array<
            | { type: "text"; text: string }
            | { type: "image_url"; image_url: { url: string } }
          >;
        }>;
      }): Promise<{
        choices: Array<{ message: { content: string | null } }>;
        usage?: { prompt_tokens: number; completion_tokens: number } | null;
      }>;
    };
  };
}

let defaultClient: OpenAI | null = null;

export function hasVisionApiKey(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export function getDefaultVisionClient(): VisionClient {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY não configurada — necessária para OCR/Vision no Step 1."
    );
  }
  if (!defaultClient) defaultClient = new OpenAI();
  return defaultClient as unknown as VisionClient;
}
