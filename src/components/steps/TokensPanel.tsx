"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, Table, Th, Td, Badge, Button } from "@/components/ui";
import { RunBar } from "./RunBar";
import type { StepPanelProps } from "./types";

interface TokenRow {
  id: string;
  index: number;
  type: string;
  text: string;
  startLine: number;
  endLine: number;
}

const FILTERS: Array<{ label: string; types: string[] | null }> = [
  { label: "Todos", types: null },
  { label: "Artigos", types: ["ARTIGO"] },
  { label: "Capítulos", types: ["CAPITULO", "TITULO_CAPITULO"] },
  { label: "Seções", types: ["SECAO", "SUBSECAO", "TITULO_SECAO"] },
  { label: "Incisos", types: ["INCISO"] },
  { label: "Parágrafos", types: ["PARAGRAFO"] },
  { label: "Alíneas", types: ["ALINEA", "ITEM"] },
  { label: "Referências", types: ["REFERENCIA_LEGAL", "NOVA_REDACAO"] },
];

const TYPE_COLORS: Record<string, "default" | "success" | "warning" | "error" | "outline"> = {
  ARTIGO: "success",
  CAPITULO: "warning",
  SECAO: "warning",
  SUBSECAO: "warning",
  PARAGRAFO: "default",
  INCISO: "default",
  ALINEA: "default",
  REFERENCIA_LEGAL: "error",
  NOVA_REDACAO: "error",
};

/** Step 3 — Tokenização: tabela de tokens com filtros. */
export function TokensPanel({ document, running, onRun }: StepPanelProps) {
  const done = document._count.tokens > 0;
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [filter, setFilter] = useState(0);
  const [limit, setLimit] = useState(500);

  const load = useCallback(async () => {
    const types = FILTERS[filter].types;
    const query = types ? `?type=${types.join(",")}` : "";
    const res = await fetch(`/api/documents/${document.id}/tokens${query}`);
    setTokens(await res.json());
  }, [document.id, filter]);

  useEffect(() => {
    if (done) load();
  }, [done, load, document._count.tokens]);

  return (
    <div className="space-y-4">
      <RunBar label="Tokenização" done={done} running={running} onRun={onRun} />

      {done && (
        <>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f, i) => (
              <Button
                key={f.label}
                size="sm"
                variant={filter === i ? "default" : "outline"}
                onClick={() => setFilter(i)}
              >
                {f.label}
              </Button>
            ))}
            <span className="ml-auto self-center text-xs text-zinc-500">
              {tokens.length} tokens
            </span>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <thead>
                  <tr>
                    <Th className="w-16">#</Th>
                    <Th className="w-44">Tipo</Th>
                    <Th>Valor</Th>
                    <Th className="w-24">Linha</Th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.slice(0, limit).map((token) => (
                    <tr key={token.id} className="hover:bg-zinc-50">
                      <Td className="text-zinc-400">{token.index}</Td>
                      <Td>
                        <Badge variant={TYPE_COLORS[token.type] ?? "outline"}>
                          {token.type}
                        </Badge>
                      </Td>
                      <Td className="max-w-xl truncate" title={token.text}>
                        {token.text}
                      </Td>
                      <Td className="text-zinc-500">
                        {token.startLine === token.endLine
                          ? token.startLine
                          : `${token.startLine}–${token.endLine}`}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {tokens.length > limit && (
                <div className="p-3 text-center">
                  <Button size="sm" variant="outline" onClick={() => setLimit(limit + 500)}>
                    Mostrar mais ({tokens.length - limit} restantes)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
