"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { RunBar } from "./RunBar";
import type { StepPanelProps } from "./types";

/** Step 5 — Estrutura da Lei: JSON definitivo + exportação. */
export function StructurePanel({ document: doc, running, onRun }: StepPanelProps) {
  const [structure, setStructure] = useState<unknown>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/documents/${doc.id}/tree`);
    if (!res.ok) {
      setStructure(null);
      return;
    }
    const data = await res.json();
    setStructure(data.structure ?? null);
  }, [doc.id]);

  useEffect(() => {
    load();
  }, [load, doc.status]);

  const done = structure != null;

  return (
    <div className="space-y-4">
      <RunBar
        label="Estrutura"
        done={done}
        running={running}
        onRun={onRun}
        extra={
          done ? (
            <a href={`/api/documents/${doc.id}/export?format=json`} download>
              <Button variant="outline">
                <Download className="h-4 w-4" /> Exportar JSON
              </Button>
            </a>
          ) : null
        }
      />

      {done ? (
        <Card>
          <CardHeader>
            <CardTitle>
              JSON da Lei — {doc._count.chapters} capítulo(s), {doc._count.articles}{" "}
              artigo(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[36rem] overflow-auto rounded bg-zinc-50 p-3 text-xs leading-5">
              {JSON.stringify(structure, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : (
        <div className="text-sm text-zinc-500">
          Execute o step para gerar o JSON definitivo da lei (requer o Parser).
        </div>
      )}
    </div>
  );
}
