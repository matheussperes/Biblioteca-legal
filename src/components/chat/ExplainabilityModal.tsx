"use client";

import { Badge, Modal } from "@/components/ui";
import { formatDuration } from "@/shared/utils";
import type { ExplainabilityTrace, RetrievedChunk } from "@/shared/rag-types";

function ChunkList({ chunks }: { chunks: RetrievedChunk[] }) {
  if (chunks.length === 0) return <p className="text-xs text-zinc-400">Nenhum chunk nesta etapa.</p>;
  return (
    <ul className="space-y-1.5">
      {chunks.map((c) => (
        <li key={`${c.stage}-${c.chunkId}`} className="rounded border border-zinc-100 bg-zinc-50 p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              {c.documentName} {c.articleLabel ? `— ${c.articleLabel}` : ""}
            </span>
            <span className="whitespace-nowrap text-zinc-500">
              {c.rerankScore != null
                ? `score ${c.rerankScore.toFixed(1)}/10`
                : c.distance != null
                  ? `dist. ${c.distance.toFixed(4)}`
                  : ""}
            </span>
          </div>
          <div className="mt-1 text-zinc-500">{c.reason}</div>
        </li>
      ))}
    </ul>
  );
}

export function ExplainabilityModal({
  trace,
  onClose,
}: {
  trace: ExplainabilityTrace | null;
  onClose: () => void;
}) {
  return (
    <Modal open={!!trace} onClose={onClose} title="Como essa resposta foi construída?" wide>
      {trace && (
        <div className="space-y-5 text-sm">
          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">1. Consulta</h4>
            <p className="rounded bg-zinc-50 p-2">{trace.question}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge>{trace.category}</Badge>
              <span className="text-xs text-zinc-500">
                confiança da classificação: {(trace.categoryConfidence * 100).toFixed(0)}%
              </span>
            </div>
          </section>

          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              2. Busca Vetorial (Top {trace.vectorStage.length})
            </h4>
            <ChunkList chunks={trace.vectorStage} />
          </section>

          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              3. Filtro por Metadados (Top {trace.metadataStage.length})
            </h4>
            <ChunkList chunks={trace.metadataStage} />
          </section>

          {trace.referenceStage.length > 0 && (
            <section>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                4. Referências Cruzadas ({trace.referenceStage.length})
              </h4>
              <ChunkList chunks={trace.referenceStage} />
            </section>
          )}

          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              5. Reranking (Top Final {trace.rerankStage.length})
            </h4>
            <ChunkList chunks={trace.rerankStage} />
          </section>

          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">6. Prompt Final</h4>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-zinc-900 p-3 text-xs text-zinc-100">
              {trace.prompt || "(não gerado — sem evidência suficiente)"}
            </pre>
          </section>

          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">7. Resposta Bruta (LLM)</h4>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-3 text-xs">
              {trace.rawResponse || "(nenhuma chamada ao LLM de geração)"}
            </pre>
          </section>

          <section className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-600 sm:grid-cols-4">
            <div>
              <div className="font-semibold text-zinc-900">Modelo</div>
              {trace.model}
            </div>
            <div>
              <div className="font-semibold text-zinc-900">Temperatura</div>
              {trace.temperature}
            </div>
            <div>
              <div className="font-semibold text-zinc-900">Tokens</div>
              {trace.promptTokens} + {trace.completionTokens}
            </div>
            <div>
              <div className="font-semibold text-zinc-900">Custo estimado</div>
              US$ {trace.costUsd.toFixed(5)}
            </div>
            <div>
              <div className="font-semibold text-zinc-900">Tempo total</div>
              {formatDuration(trace.durationMs)}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
