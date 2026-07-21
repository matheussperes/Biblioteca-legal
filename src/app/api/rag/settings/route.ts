import { NextRequest, NextResponse } from "next/server";
import { getRagConfig, saveRagConfig } from "@/modules/rag-engine";
import { mergeRagConfig } from "@/shared/rag-config";

export const dynamic = "force-dynamic";

/** GET/PUT /api/rag/settings — modelo, temperatura, Top K, Top Final, prompt, máximo de tokens, reranking. */
export async function GET() {
  const config = await getRagConfig();
  return NextResponse.json(config);
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const config = mergeRagConfig(body);

  if (config.topKVector < 1 || config.topKMetadata < 1 || config.topFinal < 1) {
    return NextResponse.json({ error: "Os valores de Top K devem ser maiores que zero." }, { status: 400 });
  }
  if (config.topFinal > config.topKMetadata || config.topKMetadata > config.topKVector) {
    return NextResponse.json(
      { error: "A ordem deve ser Top K (vetorial) ≥ Top K (metadados) ≥ Top Final." },
      { status: 400 }
    );
  }
  if (config.temperature < 0 || config.temperature > 2) {
    return NextResponse.json({ error: "Temperatura deve estar entre 0 e 2." }, { status: 400 });
  }

  await saveRagConfig(config);
  return NextResponse.json(config);
}
