import { NextResponse } from "next/server";
import { listConversations } from "@/modules/history";

export const dynamic = "force-dynamic";

/** GET /api/rag/history — lista de conversas (histórico), mais recentes primeiro. */
export async function GET() {
  const conversations = await listConversations();
  return NextResponse.json(
    conversations.map((c) => ({
      id: c.id,
      title: c.title ?? c.questions[0]?.text ?? "Nova conversa",
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      questionCount: c._count.questions,
    }))
  );
}
