import { NextRequest, NextResponse } from "next/server";
import { saveFeedback } from "@/modules/feedback";

export const dynamic = "force-dynamic";

/** POST /api/rag/feedback — { answerId, rating: "UP"|"DOWN", comment? }. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { answerId, rating, comment } = body;
  if (typeof answerId !== "string" || (rating !== "UP" && rating !== "DOWN")) {
    return NextResponse.json({ error: "Campos 'answerId' e 'rating' (UP|DOWN) são obrigatórios." }, { status: 400 });
  }
  const feedback = await saveFeedback(answerId, rating, typeof comment === "string" ? comment : undefined);
  return NextResponse.json(feedback, { status: 201 });
}
