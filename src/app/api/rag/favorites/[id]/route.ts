import { NextRequest, NextResponse } from "next/server";
import { removeFavorite } from "@/modules/feedback";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** DELETE /api/rag/favorites/:id */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  await removeFavorite(id).catch(() => null);
  return NextResponse.json({ ok: true });
}
