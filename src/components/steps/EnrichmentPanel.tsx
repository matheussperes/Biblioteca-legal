"use client";

import { useState } from "react";
import { Card, CardContent, Badge } from "@/components/ui";
import { RunBar } from "./RunBar";
import { useChunks } from "./ChunksPanel";
import type { StepPanelProps } from "./types";

/**
 * Step 7 — Enriquecimento IA: mostra por chunk o prompt enviado, a resposta,
 * o tempo e o custo estimado, com botão para executar novamente.
 */
export function EnrichmentPanel({ document: doc, running, onRun, refreshTick }: StepPanelProps) {
  // `refreshTick` (não `doc.status`) garante que a lista recarregue a cada
  // lote do Step 7, já que o status só avança quando todos os chunks
  // terminam — em documentos grandes isso pode levar vários lotes.
  const chunks = useChunks(doc.id, `enrichment-${refreshTick}`);
  const enriched = chunks.filter((c) => c.enrichment != null);
  const done = enriched.length > 0;
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<"resultado" | "prompt" | "resposta">("resultado");

  const totalCost = enriched.reduce((sum, c) => sum + (c.enrichmentCostUsd ?? 0), 0);
  const totalTime = enriched.reduce((sum, c) => sum + (c.enrichmentDurationMs ?? 0), 0);

  return (
    <div className="space-y-4">
      <RunBar
        label="Enriquecimento"
        done={done}
        running={running}
        onRun={onRun}
        extra={
          done ? (
            <div className="flex gap-2 text-xs">
              <Badge>
                {enriched.length}/{chunks.length} chunks enriquecidos
              </Badge>
              <Badge>tempo total: {(totalTime / 1000).toFixed(1)} s</Badge>
              <Badge>custo estimado: ${totalCost.toFixed(4)}</Badge>
            </div>
          ) : null
        }
      />

      {chunks.length === 0 && (
        <div className="text-sm text-zinc-500">
          Execute a Chunkização antes do Enriquecimento IA.
        </div>
      )}

      <div className="space-y-2">
        {chunks.map((chunk) => (
          <Card key={chunk.id}>
            <CardContent
              className="cursor-pointer p-3"
              onClick={() => setOpen(open === chunk.id ? null : chunk.id)}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={chunk.enrichment ? "success" : "outline"}>
                  Chunk {chunk.index + 1}
                </Badge>
                {chunk.originArticle && (
                  <Badge variant="outline">{chunk.originArticle}</Badge>
                )}
                {chunk.enrichment ? (
                  <>
                    <Badge>{chunk.enrichmentModel}</Badge>
                    <Badge>{chunk.enrichmentDurationMs} ms</Badge>
                    <Badge>${(chunk.enrichmentCostUsd ?? 0).toFixed(5)}</Badge>
                    <span className="truncate text-zinc-500">
                      {String(
                        (chunk.enrichment as { resumo?: string }).resumo ?? ""
                      ).slice(0, 120)}
                    </span>
                  </>
                ) : (
                  <span className="text-zinc-400">não enriquecido</span>
                )}
              </div>

              {open === chunk.id && chunk.enrichment && (
                <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    {(["resultado", "prompt", "resposta"] as const).map((t) => (
                      <button
                        key={t}
                        className={`rounded px-2 py-1 text-xs ${
                          tab === t
                            ? "bg-indigo-600 text-white"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        }`}
                        onClick={() => setTab(t)}
                      >
                        {t === "resultado"
                          ? "Resultado"
                          : t === "prompt"
                            ? "Prompt enviado"
                            : "Resposta bruta"}
                      </button>
                    ))}
                  </div>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-3 text-xs leading-5">
                    {tab === "resultado"
                      ? JSON.stringify(chunk.enrichment, null, 2)
                      : tab === "prompt"
                        ? chunk.enrichmentPrompt
                        : chunk.enrichmentResponse}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
