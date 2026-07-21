"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Spinner, Textarea } from "@/components/ui";
import type { RagConfig } from "@/shared/rag-config";

export default function RagSettingsPage() {
  const [config, setConfig] = useState<RagConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rag/settings")
      .then((r) => r.json())
      .then(setConfig);
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/rag/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    setMessage(res.ok ? "Configurações salvas." : (data.error ?? "Erro ao salvar."));
    setSaving(false);
  };

  if (!config) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-zinc-500">
        <Spinner /> Carregando configurações...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Configurações — Motor RAG</h1>
        <Button onClick={save} disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>

      {message && (
        <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm">{message}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Modelo e Geração</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Modelo LLM</label>
            <Input value={config.model} onChange={(e) => setConfig({ ...config, model: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Temperatura</label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={config.temperature}
              onChange={(e) => setConfig({ ...config, temperature: Number(e.target.value) })}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Temperatura 0 produz respostas determinísticas (recomendado).
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Máximo de Tokens</label>
            <Input
              type="number"
              value={config.maxTokens}
              onChange={(e) => setConfig({ ...config, maxTokens: Number(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recuperação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Top K — Busca Vetorial</label>
            <Input
              type="number"
              value={config.topKVector}
              onChange={(e) => setConfig({ ...config, topKVector: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Top K — Metadados</label>
            <Input
              type="number"
              value={config.topKMetadata}
              onChange={(e) => setConfig({ ...config, topKMetadata: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Top Final (enviado ao LLM)</label>
            <Input
              type="number"
              value={config.topFinal}
              onChange={(e) => setConfig({ ...config, topFinal: Number(e.target.value) })}
            />
          </div>
          <div className="sm:col-span-3">
            <label className="mb-1 block text-sm text-zinc-600">Reranking</label>
            <Select
              value={config.rerankingEnabled ? "on" : "off"}
              onChange={(e) => setConfig({ ...config, rerankingEnabled: e.target.value === "on" })}
            >
              <option value="on">Ativado</option>
              <option value="off">Desativado</option>
            </Select>
          </div>
          <p className="text-xs text-zinc-500 sm:col-span-3">
            A ordem deve respeitar Top K (vetorial) ≥ Top K (metadados) ≥ Top Final.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prompt de Geração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <label className="block text-sm text-zinc-600">
            Placeholders disponíveis: {"{{PERGUNTA}}"} e {"{{CONTEXTO}}"}
          </label>
          <Textarea
            rows={20}
            className="font-mono text-xs"
            value={config.prompt}
            onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
