"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Badge,
} from "@/components/ui";
import { RunBar } from "./RunBar";
import type { StepPanelProps } from "./types";

export interface ChunkRow {
  id: string;
  index: number;
  content: string;
  tokenCount: number;
  charCount: number;
  part: number;
  totalParts: number;
  originArticle: string | null;
  originChapter: string | null;
  originSection: string | null;
  enrichment: Record<string, unknown> | null;
  enrichmentPrompt: string | null;
  enrichmentResponse: string | null;
  enrichmentModel: string | null;
  enrichmentDurationMs: number | null;
  enrichmentCostUsd: number | null;
}

export function useChunks(documentId: string, refreshKey: string) {
  const [chunks, setChunks] = useState<ChunkRow[]>([]);
  const load = useCallback(async () => {
    const res = await fetch(`/api/documents/${documentId}/chunks`);
    setChunks(await res.json());
  }, [documentId]);
  useEffect(() => {
    load();
  }, [load, refreshKey]);
  return chunks;
}

/** Step 6 — Chunkização: lista de chunks com tokens, caracteres e origem. */
export function ChunksPanel({ document: doc, running, onRun }: StepPanelProps) {
  const chunks = useChunks(doc.id, `${doc.status}-${doc._count.chunks}`);
  const done = doc._count.chunks > 0;
  const [openChunk, setOpenChunk] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <RunBar
        label="Chunkização"
        done={done}
        running={running}
        onRun={onRun}
        extra={
          done ? (
            <a href={`/api/documents/${doc.id}/export?format=chunks`} download>
              <Button variant="outline">
                <Download className="h-4 w-4" /> Exportar Chunks
              </Button>
            </a>
          ) : null
        }
      />

      {done && (
        <div className="space-y-2">
          {chunks.map((chunk) => (
            <Card key={chunk.id}>
              <CardContent
                className="cursor-pointer p-3"
                onClick={() => setOpenChunk(openChunk === chunk.id ? null : chunk.id)}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="success">Chunk {chunk.index + 1}</Badge>
                  {chunk.totalParts > 1 && (
                    <Badge variant="warning">
                      Parte {chunk.part}/{chunk.totalParts}
                    </Badge>
                  )}
                  <Badge>{chunk.tokenCount} tokens</Badge>
                  <Badge>{chunk.charCount} caracteres</Badge>
                  {chunk.originArticle && (
                    <Badge variant="outline">{chunk.originArticle}</Badge>
                  )}
                  {chunk.originChapter && (
                    <span className="text-zinc-500">{chunk.originChapter}</span>
                  )}
                  {chunk.originSection && (
                    <span className="text-zinc-400">/ {chunk.originSection}</span>
                  )}
                </div>
                {openChunk === chunk.id ? (
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-3 text-xs leading-5">
                    {chunk.content}
                  </pre>
                ) : (
                  <div className="mt-2 truncate text-xs text-zinc-500">
                    {chunk.content.slice(0, 180)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
