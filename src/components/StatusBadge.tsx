"use client";

import { Badge } from "./ui";

const STATUS_LABELS: Record<string, string> = {
  UPLOADED: "Upload",
  EXTRACTED: "Extraído",
  CLEANED: "Limpo",
  TOKENIZED: "Tokenizado",
  PARSED: "Parseado",
  TREE_CREATED: "Árvore criada",
  CHUNKED: "Chunkizado",
  ENRICHED: "Enriquecido",
  EMBEDDED: "Embeddings gerados",
  INDEXED: "Indexado",
};

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "INDEXED"
      ? "success"
      : status === "UPLOADED"
        ? "outline"
        : "default";
  return <Badge variant={variant}>{STATUS_LABELS[status] ?? status}</Badge>;
}
