"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Textarea,
  Spinner,
} from "@/components/ui";
import type { PipelineConfig } from "@/shared/config";

const REGEX_LABELS: Record<string, string> = {
  capitulo: "Capítulo",
  secao: "Seção",
  subsecao: "Subseção",
  artigo: "Artigo",
  paragrafo: "Parágrafo",
  inciso: "Inciso",
  alinea: "Alínea",
  item: "Item",
  observacao: "Observação",
  novaRedacao: "Nova Redação",
  referenciaLegal: "Referência Legal",
};

export default function SettingsPage() {
  const [config, setConfig] = useState<PipelineConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setConfig);
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/settings", {
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
        <h1 className="text-xl font-semibold">Configurações</h1>
        <Button onClick={save} disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>

      {message && (
        <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Editor de Regex — Tokenização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(config.regex).map(([key, value]) => (
            <div key={key} className="grid grid-cols-1 gap-2 sm:grid-cols-[10rem_1fr]">
              <label className="self-center text-sm text-zinc-600">
                {REGEX_LABELS[key] ?? key}
              </label>
              <Input
                className="font-mono text-xs"
                value={value}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    regex: { ...config.regex, [key]: e.target.value },
                  })
                }
              />
            </div>
          ))}
          <p className="text-xs text-zinc-500">
            Após alterar um regex, reexecute a Tokenização — o Parser, os Chunks e
            os passos seguintes serão refeitos a partir dela, sem repetir o upload.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Editor de Chunk</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Chunk Size (tokens)</label>
            <Input
              type="number"
              value={config.chunking.chunkSize}
              onChange={(e) =>
                setConfig({
                  ...config,
                  chunking: { ...config.chunking, chunkSize: Number(e.target.value) },
                })
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">
              Overlap (unidades estruturais)
            </label>
            <Input
              type="number"
              value={config.chunking.overlap}
              onChange={(e) =>
                setConfig({
                  ...config,
                  chunking: { ...config.chunking, overlap: Number(e.target.value) },
                })
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Máximo Tokens</label>
            <Input
              type="number"
              value={config.chunking.maxTokens}
              onChange={(e) =>
                setConfig({
                  ...config,
                  chunking: { ...config.chunking, maxTokens: Number(e.target.value) },
                })
              }
            />
          </div>
          <div className="sm:col-span-3">
            <label className="mb-1 block text-sm text-zinc-600">Estratégia</label>
            <Select
              value={config.chunking.strategy}
              onChange={(e) =>
                setConfig({
                  ...config,
                  chunking: {
                    ...config.chunking,
                    strategy: e.target.value as "article",
                  },
                })
              }
            >
              <option value="article">Um artigo por chunk (com divisão segura)</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Editor IA — Enriquecimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">
              Prompt (placeholders: {"{{TEXTO}}"} e {"{{CONTEXTO}}"})
            </label>
            <Textarea
              rows={14}
              className="font-mono text-xs"
              value={config.enrichment.prompt}
              onChange={(e) =>
                setConfig({
                  ...config,
                  enrichment: { ...config.enrichment, prompt: e.target.value },
                })
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Modelo</label>
              <Input
                value={config.enrichment.model}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    enrichment: { ...config.enrichment, model: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Temperatura</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={config.enrichment.temperature}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    enrichment: {
                      ...config.enrichment,
                      temperature: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Máximo Tokens</label>
              <Input
                type="number"
                value={config.enrichment.maxTokens}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    enrichment: {
                      ...config.enrichment,
                      maxTokens: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OCR / Visão — Figuras (Step 1)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={config.ocr.enabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  ocr: { ...config.ocr, enabled: e.target.checked },
                })
              }
            />
            Habilitar OCR via Vision API para PDFs escaneados e detecção de figuras
          </label>
          <p className="text-xs text-zinc-500">
            Substitui a extração de texto apenas nas páginas sem camada de texto
            (digitalizadas) e recorta figuras (mapas, plantas, diagramas) das
            páginas que contêm imagens embutidas. Requer OPENAI_API_KEY.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Modelo (visão)</label>
              <Input
                value={config.ocr.model}
                onChange={(e) =>
                  setConfig({ ...config, ocr: { ...config.ocr, model: e.target.value } })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">
                Máx. páginas processadas
              </label>
              <Input
                type="number"
                value={config.ocr.maxPages}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    ocr: { ...config.ocr, maxPages: Number(e.target.value) },
                  })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">
                Máx. figuras por documento
              </label>
              <Input
                type="number"
                value={config.ocr.maxFigures}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    ocr: { ...config.ocr, maxFigures: Number(e.target.value) },
                  })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">
                Largura mínima da figura (px)
              </label>
              <Input
                type="number"
                value={config.ocr.minFigureWidth}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    ocr: { ...config.ocr, minFigureWidth: Number(e.target.value) },
                  })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">
                Altura mínima da figura (px)
              </label>
              <Input
                type="number"
                value={config.ocr.minFigureHeight}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    ocr: { ...config.ocr, minFigureHeight: Number(e.target.value) },
                  })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">
                Escala de renderização
              </label>
              <Input
                type="number"
                step="0.1"
                value={config.ocr.renderScale}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    ocr: { ...config.ocr, renderScale: Number(e.target.value) },
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modelo de Embedding</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Modelo</label>
            <Select
              value={config.embeddings.model}
              onChange={(e) =>
                setConfig({
                  ...config,
                  embeddings: { ...config.embeddings, model: e.target.value },
                })
              }
            >
              <option value="text-embedding-3-small">text-embedding-3-small</option>
              <option value="text-embedding-3-large">text-embedding-3-large</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Dimensão</label>
            <Input
              type="number"
              value={config.embeddings.dimension}
              onChange={(e) =>
                setConfig({
                  ...config,
                  embeddings: {
                    ...config.embeddings,
                    dimension: Number(e.target.value),
                  },
                })
              }
            />
            <p className="mt-1 text-xs text-zinc-500">
              A coluna vetorial do banco é vector(1536); mantenha 1536, ou ajuste a
              migração ao mudar.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
