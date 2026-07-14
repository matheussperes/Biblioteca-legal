import { NextRequest, NextResponse } from "next/server";
import { getPipelineConfig, savePipelineConfig } from "@/modules/pipeline";
import { mergeConfig } from "@/shared/config";

export const dynamic = "force-dynamic";

/** Configurações — regex, chunkização, IA e embeddings. */
export async function GET() {
  const config = await getPipelineConfig();
  return NextResponse.json(config);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const config = mergeConfig(body);

  // valida os regexes antes de salvar
  for (const [name, pattern] of Object.entries(config.regex)) {
    try {
      new RegExp(pattern);
    } catch {
      return NextResponse.json(
        { error: `Regex inválido em "${name}": ${pattern}` },
        { status: 400 }
      );
    }
  }

  await savePipelineConfig(config);
  return NextResponse.json(config);
}
