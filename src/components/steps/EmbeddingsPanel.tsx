"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Table,
  Th,
  Td,
  Badge,
} from "@/components/ui";
import { RunBar } from "./RunBar";
import type { StepPanelProps } from "./types";

interface EmbeddingRow {
  id: string;
  chunkId: string;
  model: string;
  dimension: number;
  hash: string;
  durationMs: number;
  indexed: boolean;
  indexedAt: string | null;
  chunk: { index: number; originArticle: string | null };
}

export function useEmbeddings(documentId: string, refreshKey: string) {
  const [rows, setRows] = useState<EmbeddingRow[]>([]);
  const load = useCallback(async () => {
    const res = await fetch(`/api/documents/${documentId}/embeddings`);
    setRows(await res.json());
  }, [documentId]);
  useEffect(() => {
    load();
  }, [load, refreshKey]);
  return rows;
}

/** Step 8 — Embeddings: lista chunk × embedding × status × modelo × dimensão. */
export function EmbeddingsPanel({ document: doc, running, onRun }: StepPanelProps) {
  const rows = useEmbeddings(doc.id, `${doc.status}-${doc._count.embeddings}`);
  const done = doc._count.embeddings > 0;

  return (
    <div className="space-y-4">
      <RunBar
        label="Embeddings"
        done={done}
        running={running}
        onRun={onRun}
        extra={
          done ? (
            <a href={`/api/documents/${doc.id}/export?format=embeddings`} download>
              <Button variant="outline">
                <Download className="h-4 w-4" /> Exportar metadados
              </Button>
            </a>
          ) : null
        }
      />

      {done && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <thead>
                <tr>
                  <Th>Chunk</Th>
                  <Th>Origem</Th>
                  <Th>Status</Th>
                  <Th>Modelo</Th>
                  <Th className="text-right">Dimensão</Th>
                  <Th className="text-right">Tempo</Th>
                  <Th>Hash</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-50">
                    <Td>Chunk {row.chunk.index + 1}</Td>
                    <Td>{row.chunk.originArticle ?? "—"}</Td>
                    <Td>
                      <Badge variant={row.indexed ? "success" : "default"}>
                        {row.indexed ? "Indexado" : "Gerado"}
                      </Badge>
                    </Td>
                    <Td>{row.model}</Td>
                    <Td className="text-right">{row.dimension}</Td>
                    <Td className="text-right">{row.durationMs} ms</Td>
                    <Td>
                      <code className="text-xs text-zinc-500">
                        {row.hash.slice(0, 12)}…
                      </code>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
