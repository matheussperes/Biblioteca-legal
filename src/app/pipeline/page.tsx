"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePlus2, Play, RefreshCw, Trash2 } from "lucide-react";
import { Button, Card, CardContent, Table, Th, Td, Spinner } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";

interface DocumentRow {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  articleCount: number;
  chunkCount: number;
  embeddingCount: number;
  indexedCount: number;
}

/** Próximo step a executar de acordo com o status atual. */
const NEXT_STEP: Record<string, string | null> = {
  UPLOADED: "extraction",
  EXTRACTED: "cleaning",
  CLEANED: "tokenization",
  TOKENIZED: "parsing",
  PARSED: "tree",
  TREE_CREATED: "chunking",
  CHUNKED: "enrichment",
  ENRICHED: "embeddings",
  EMBEDDED: "indexing",
  INDEXED: null,
};

export default function DashboardPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/documents");
    setDocuments(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const continuePipeline = async (doc: DocumentRow) => {
    const step = NEXT_STEP[doc.status];
    if (!step) {
      router.push(`/documents/${doc.id}`);
      return;
    }
    setBusy(doc.id);
    await fetch(`/api/documents/${doc.id}/steps/${step}`, { method: "POST" });
    setBusy(null);
    await load();
  };

  const reprocess = async (doc: DocumentRow) => {
    if (!confirm(`Reprocessar "${doc.name}" desde a extração?`)) return;
    setBusy(doc.id);
    await fetch(`/api/documents/${doc.id}/steps/extraction`, { method: "POST" });
    setBusy(null);
    router.push(`/documents/${doc.id}`);
  };

  const remove = async (doc: DocumentRow) => {
    if (!confirm(`Excluir "${doc.name}" e todos os seus artefatos?`)) return;
    await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Documentos</h1>
        <Link href="/upload">
          <Button>
            <FilePlus2 className="h-4 w-4" /> Novo Documento
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {documents === null ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-zinc-500">
              <Spinner /> Carregando...
            </div>
          ) : documents.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              Nenhum documento ainda.{" "}
              <Link href="/upload" className="text-indigo-600 hover:underline">
                Envie o primeiro documento
              </Link>
              .
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Nome</Th>
                  <Th>Tipo</Th>
                  <Th>Data Upload</Th>
                  <Th>Status Atual</Th>
                  <Th className="text-right">Artigos</Th>
                  <Th className="text-right">Chunks</Th>
                  <Th className="text-right">Embeddings</Th>
                  <Th className="text-right">Indexado</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-zinc-50">
                    <Td>
                      <Link
                        href={`/documents/${doc.id}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {doc.name}
                      </Link>
                    </Td>
                    <Td>{doc.type}</Td>
                    <Td className="whitespace-nowrap">
                      {new Date(doc.createdAt).toLocaleString("pt-BR")}
                    </Td>
                    <Td>
                      <StatusBadge status={doc.status} />
                    </Td>
                    <Td className="text-right">{doc.articleCount}</Td>
                    <Td className="text-right">{doc.chunkCount}</Td>
                    <Td className="text-right">{doc.embeddingCount}</Td>
                    <Td className="text-right">
                      {doc.indexedCount > 0
                        ? `${doc.indexedCount}/${doc.chunkCount}`
                        : "—"}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy === doc.id || doc.status === "INDEXED"}
                          onClick={() => continuePipeline(doc)}
                          title="Continuar Pipeline"
                        >
                          {busy === doc.id ? (
                            <Spinner className="h-3 w-3" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                          Continuar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === doc.id}
                          onClick={() => reprocess(doc)}
                          title="Reprocessar desde a extração"
                        >
                          <RefreshCw className="h-3 w-3" /> Reprocessar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove(doc)}
                          title="Excluir"
                        >
                          <Trash2 className="h-3 w-3 text-red-600" />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
