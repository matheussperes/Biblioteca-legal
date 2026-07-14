"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { RunBar } from "./RunBar";
import { useEmbeddings } from "./EmbeddingsPanel";
import type { StepPanelProps } from "./types";

/** Step 9 — Banco Vetorial: quantidade indexada, tempo e erros. */
export function IndexPanel({ document: doc, running, onRun }: StepPanelProps) {
  const rows = useEmbeddings(doc.id, `${doc.status}-index-${doc.indexedCount}`);
  const indexed = rows.filter((r) => r.indexed);
  const done = doc.status === "INDEXED";

  return (
    <div className="space-y-4">
      <RunBar label="Indexação" done={done} running={running} onRun={onRun} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Quantidade Indexada</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {indexed.length}
            <span className="text-sm font-normal text-zinc-500">
              {" "}
              / {doc._count.chunks} chunks
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {done ? (
              <span className="text-emerald-600">INDEXED ✓</span>
            ) : (
              <span className="text-zinc-400">{doc.status}</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pendentes</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {rows.length - indexed.length}
          </CardContent>
        </Card>
      </div>

      {done && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Documento indexado no banco vetorial (pgvector) com os respectivos
          metadados — pronto para ser utilizado por qualquer mecanismo de RAG na
          Fase 2.
        </div>
      )}
    </div>
  );
}
