"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { RunBar } from "./RunBar";
import type { StepPanelProps } from "./types";

/** Step 1 — Extração: documento à esquerda, texto extraído à direita. */
export function ExtractionPanel({ document, running, onRun }: StepPanelProps) {
  const done = document.extractedText != null;

  return (
    <div className="space-y-4">
      <RunBar label="Extração" done={done} running={running} onRun={onRun} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Documento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-zinc-500">Nome:</span> {document.name}
            </div>
            <div>
              <span className="text-zinc-500">Tipo:</span> {document.type}
              {document.mimeType ? ` (${document.mimeType})` : ""}
            </div>
            <div>
              <span className="text-zinc-500">Tamanho:</span>{" "}
              {(document.sizeBytes / 1024).toFixed(1)} KB
            </div>
            {document.extractionMeta && (
              <>
                {document.extractionMeta.pages != null && (
                  <div>
                    <span className="text-zinc-500">Páginas:</span>{" "}
                    {document.extractionMeta.pages}
                  </div>
                )}
                <div>
                  <span className="text-zinc-500">Engine:</span>{" "}
                  {document.extractionMeta.engine}
                </div>
                <div>
                  <span className="text-zinc-500">Duração:</span>{" "}
                  {document.extractionMeta.durationMs} ms
                </div>
                {(document.extractionMeta.warnings ?? []).map((w, i) => (
                  <div
                    key={i}
                    className="rounded bg-amber-50 px-2 py-1 text-amber-700"
                  >
                    {w}
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Texto extraído</CardTitle>
          </CardHeader>
          <CardContent>
            {done ? (
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap text-xs leading-5 text-zinc-700">
                {document.extractedText}
              </pre>
            ) : (
              <div className="text-sm text-zinc-500">
                Execute a extração para visualizar o texto.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
