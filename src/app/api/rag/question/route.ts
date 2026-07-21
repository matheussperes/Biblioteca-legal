import { NextRequest, NextResponse } from "next/server";
import { askQuestion } from "@/modules/rag-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST /api/rag/question — pergunta avulsa (cria uma nova conversa quando conversationId não é informado). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Campo 'text' ausente ou vazio." }, { status: 400 });
  }

  try {
    const result = await askQuestion(text, body.conversationId ?? null);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("OPENAI_API_KEY") ? 424 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
