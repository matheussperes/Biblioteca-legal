import { NextRequest, NextResponse } from "next/server";
import { addFavorite, listFavorites } from "@/modules/feedback";

export const dynamic = "force-dynamic";

/** GET /api/rag/favorites?type= — lista favoritos (perguntas, leis, artigos, respostas). */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") ?? undefined;
  const favorites = await listFavorites(type);
  return NextResponse.json(favorites);
}

/** POST /api/rag/favorites — { type, refId, title, note? }. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { type, refId, title, note } = body;
  if (typeof type !== "string" || typeof refId !== "string" || typeof title !== "string") {
    return NextResponse.json({ error: "Campos 'type', 'refId' e 'title' são obrigatórios." }, { status: 400 });
  }
  const favorite = await addFavorite(type, refId, title, typeof note === "string" ? note : undefined);
  return NextResponse.json(favorite, { status: 201 });
}
