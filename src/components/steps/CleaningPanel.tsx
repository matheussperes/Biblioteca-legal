"use client";

import { useMemo } from "react";
import { diffLines } from "diff";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { RunBar } from "./RunBar";
import type { StepPanelProps } from "./types";

/** Step 2 — Limpeza: mostra o diff antes/depois e as operações aplicadas. */
export function CleaningPanel({ document, running, onRun }: StepPanelProps) {
  const done = document.cleanedText != null;

  const diff = useMemo(() => {
    if (!document.extractedText || document.cleanedText == null) return null;
    // limita o diff para não travar o navegador em documentos gigantes
    const before = document.extractedText.slice(0, 200_000);
    const after = document.cleanedText.slice(0, 200_000);
    return diffLines(before, after);
  }, [document.extractedText, document.cleanedText]);

  return (
    <div className="space-y-4">
      <RunBar label="Limpeza" done={done} running={running} onRun={onRun} />

      {document.cleaningStats && (
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge>
            {document.cleaningStats.charsBefore} → {document.cleaningStats.charsAfter}{" "}
            caracteres
          </Badge>
          <Badge>
            {document.cleaningStats.linesBefore} → {document.cleaningStats.linesAfter}{" "}
            linhas
          </Badge>
          {Object.entries(document.cleaningStats.operations)
            .filter(([, count]) => count > 0)
            .map(([name, count]) => (
              <Badge key={name} variant="outline">
                {name.replaceAll("_", " ")}: {count}
              </Badge>
            ))}
        </div>
      )}

      {done && diff ? (
        <Card>
          <CardHeader>
            <CardTitle>Diff — Antes / Depois</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[36rem] overflow-auto text-xs leading-5">
              {diff.map((part, i) => (
                <span
                  key={i}
                  className={
                    part.added
                      ? "bg-emerald-50 text-emerald-800"
                      : part.removed
                        ? "bg-red-50 text-red-700 line-through"
                        : "text-zinc-600"
                  }
                >
                  {part.value}
                </span>
              ))}
            </pre>
          </CardContent>
        </Card>
      ) : (
        <div className="text-sm text-zinc-500">
          {document.extractedText == null
            ? "Execute a Extração antes da Limpeza."
            : "Execute a limpeza para visualizar o diff."}
        </div>
      )}
    </div>
  );
}
