import { NextRequest, NextResponse } from "next/server";
import { getConversation } from "@/modules/history";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/rag/history/:id — detalhe da conversa com todas as perguntas e respostas. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }
  return NextResponse.json(conversation);
}
