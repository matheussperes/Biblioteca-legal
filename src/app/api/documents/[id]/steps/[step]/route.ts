import { NextRequest, NextResponse } from "next/server";
import { runStep, runPipelineFrom } from "@/modules/pipeline";
import { PIPELINE_STEPS, type PipelineStep } from "@/shared/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string; step: string }> };

/**
 * Executa um step do pipeline (POST).
 * `?cascade=true` executa do step indicado até o fim do pipeline.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id, step } = await params;
  const stepName = step.toUpperCase() as PipelineStep;

  if (!PIPELINE_STEPS.includes(stepName)) {
    return NextResponse.json(
      { error: `Step inválido: ${step}. Válidos: ${PIPELINE_STEPS.join(", ")}` },
      { status: 400 }
    );
  }

  const cascade = request.nextUrl.searchParams.get("cascade") === "true";

  try {
    const result = cascade
      ? await runPipelineFrom(id, stepName)
      : await runStep(id, stepName);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
