"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, FastForward, ScrollText } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import type { DocumentDetail } from "@/components/steps/types";
import { ExtractionPanel } from "@/components/steps/ExtractionPanel";
import { CleaningPanel } from "@/components/steps/CleaningPanel";
import { TokensPanel } from "@/components/steps/TokensPanel";
import { ParserPanel } from "@/components/steps/ParserPanel";
import { StructurePanel } from "@/components/steps/StructurePanel";
import { ChunksPanel } from "@/components/steps/ChunksPanel";
import { EnrichmentPanel } from "@/components/steps/EnrichmentPanel";
import { EmbeddingsPanel } from "@/components/steps/EmbeddingsPanel";
import { IndexPanel } from "@/components/steps/IndexPanel";
import { LogsPanel } from "@/components/steps/LogsPanel";

const STEPS = [
  { id: "extraction", label: "1. Extração", doneAt: "EXTRACTED" },
  { id: "cleaning", label: "2. Limpeza", doneAt: "CLEANED" },
  { id: "tokenization", label: "3. Tokenização", doneAt: "TOKENIZED" },
  { id: "parsing", label: "4. Parser", doneAt: "PARSED" },
  { id: "tree", label: "5. Estrutura da Lei", doneAt: "TREE_CREATED" },
  { id: "chunking", label: "6. Chunkização", doneAt: "CHUNKED" },
  { id: "enrichment", label: "7. Enriquecimento IA", doneAt: "ENRICHED" },
  { id: "embeddings", label: "8. Embeddings", doneAt: "EMBEDDED" },
  { id: "indexing", label: "9. Banco Vetorial", doneAt: "INDEXED" },
] as const;

const STATUS_ORDER = [
  "UPLOADED",
  "EXTRACTED",
  "CLEANED",
  "TOKENIZED",
  "PARSED",
  "TREE_CREATED",
  "CHUNKED",
  "ENRICHED",
  "EMBEDDED",
  "INDEXED",
];

export default function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [active, setActive] = useState<string>("extraction");
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/documents/${id}`);
    if (res.ok) setDoc(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // seleciona automaticamente o próximo step pendente ao abrir
  useEffect(() => {
    if (!doc) return;
    const statusIdx = STATUS_ORDER.indexOf(doc.status);
    const next = STEPS[Math.min(statusIdx, STEPS.length - 1)];
    setActive((prev) => (prev === "extraction" && next ? next.id : prev));
    // executa apenas na primeira carga
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  const runStep = async (stepId: string, cascade = false) => {
    setRunning(stepId);
    setError(null);
    try {
      const res = await fetch(
        `/api/documents/${id}/steps/${stepId}${cascade ? "?cascade=true" : ""}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Falha ao executar o step.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
      await load();
    }
  };

  if (!doc) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-zinc-500">
        <Spinner /> Carregando documento...
      </div>
    );
  }

  const statusIdx = STATUS_ORDER.indexOf(doc.status);

  const panelProps = (stepId: string) => ({
    document: doc,
    running: running === stepId,
    onRun: () => runStep(stepId),
    onReload: load,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">{doc.name}</h1>
        <StatusBadge status={doc.status} />
        <div className="ml-auto flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={running != null || doc.status === "INDEXED"}
            onClick={() => {
              const next = STEPS[Math.min(statusIdx, STEPS.length - 1)];
              if (next) runStep(next.id, true);
            }}
            title="Executa todos os steps restantes em sequência"
          >
            {running ? <Spinner className="h-3 w-3" /> : <FastForward className="h-4 w-4" />}
            Executar até o fim
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-56">
          <nav className="flex flex-row flex-wrap gap-1 lg:flex-col">
            {STEPS.map((step, i) => {
              const done = statusIdx > i;
              return (
                <button
                  key={step.id}
                  onClick={() => setActive(step.id)}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    active === step.id
                      ? "bg-indigo-600 text-white"
                      : done
                        ? "text-zinc-700 hover:bg-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-100"
                  }`}
                >
                  {running === step.id ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : done ? (
                    <Check
                      className={`h-3.5 w-3.5 ${active === step.id ? "text-white" : "text-emerald-600"}`}
                    />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-current opacity-40" />
                  )}
                  {step.label}
                </button>
              );
            })}
            <button
              onClick={() => setActive("logs")}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                active === "logs"
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <ScrollText className="h-3.5 w-3.5" /> Logs e Histórico
            </button>
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          {active === "extraction" && <ExtractionPanel {...panelProps("extraction")} />}
          {active === "cleaning" && <CleaningPanel {...panelProps("cleaning")} />}
          {active === "tokenization" && <TokensPanel {...panelProps("tokenization")} />}
          {active === "parsing" && <ParserPanel {...panelProps("parsing")} />}
          {active === "tree" && <StructurePanel {...panelProps("tree")} />}
          {active === "chunking" && <ChunksPanel {...panelProps("chunking")} />}
          {active === "enrichment" && <EnrichmentPanel {...panelProps("enrichment")} />}
          {active === "embeddings" && <EmbeddingsPanel {...panelProps("embeddings")} />}
          {active === "indexing" && <IndexPanel {...panelProps("indexing")} />}
          {active === "logs" && <LogsPanel document={doc} />}
        </section>
      </div>
    </div>
  );
}
