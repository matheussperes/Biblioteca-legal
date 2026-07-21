"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Badge, Button, Modal, Spinner } from "@/components/ui";

interface ArticleDetail {
  id: string;
  label: string;
  caput: string;
  fullText: string;
  lei: string;
  documentId: string;
  capitulo: { label: string; titulo: string | null } | null;
  secao: { label: string; titulo: string | null } | null;
  paragrafos: Array<{
    label: string;
    texto: string;
    incisos: Array<{ label: string; texto: string; alineas: Array<{ label: string; texto: string }> }>;
  }>;
  incisos: Array<{ label: string; texto: string; alineas: Array<{ label: string; texto: string }> }>;
  enrichment: Record<string, unknown> | null;
  situacao: string;
}

export function ArticleViewerModal({
  articleId,
  onClose,
}: {
  articleId: string | null;
  onClose: () => void;
}) {
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!articleId) {
      setArticle(null);
      return;
    }
    setLoading(true);
    fetch(`/api/rag/article/${articleId}`)
      .then((res) => res.json())
      .then((data) => setArticle(data))
      .finally(() => setLoading(false));
  }, [articleId]);

  const favorite = async () => {
    if (!article) return;
    await fetch("/api/rag/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ARTICLE",
        refId: article.id,
        title: `${article.lei} — ${article.label}`,
      }),
    });
  };

  const palavrasChave = Array.isArray(article?.enrichment?.palavras_chave)
    ? (article!.enrichment!.palavras_chave as string[])
    : [];
  const referencias = Array.isArray(article?.enrichment?.referencias)
    ? (article!.enrichment!.referencias as string[])
    : [];

  return (
    <Modal open={!!articleId} onClose={onClose} title="Visualizador Jurídico" wide>
      {loading || !article ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-zinc-500">
          <Spinner /> Carregando artigo...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{article.lei}</div>
              <h2 className="text-lg font-semibold">{article.label}</h2>
              <div className="mt-1 text-xs text-zinc-500">
                {article.capitulo?.label ?? ""} {article.secao?.label ? `— ${article.secao.label}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={article.situacao === "Vigente" ? "success" : "warning"}>{article.situacao}</Badge>
              <Button size="sm" variant="outline" onClick={favorite}>
                <Star className="h-3 w-3" /> Favoritar
              </Button>
            </div>
          </div>

          {typeof article.enrichment?.resumo === "string" && article.enrichment.resumo && (
            <div className="rounded-md bg-indigo-50 p-3 text-sm text-indigo-900">
              <strong>Resumo:</strong> {article.enrichment.resumo}
            </div>
          )}

          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{article.caput}</div>
            {article.paragrafos.map((p) => (
              <div key={p.label} className="mt-2 pl-4 text-sm">
                <div className="whitespace-pre-wrap">
                  <strong>{p.label}</strong> {p.texto}
                </div>
                {p.incisos.map((i) => (
                  <div key={i.label} className="mt-1 pl-4 text-sm">
                    <strong>{i.label}</strong> — {i.texto}
                    {i.alineas.map((a) => (
                      <div key={a.label} className="pl-4 text-sm">
                        <strong>{a.label})</strong> {a.texto}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
            {article.incisos.map((i) => (
              <div key={i.label} className="mt-1 pl-4 text-sm">
                <strong>{i.label}</strong> — {i.texto}
                {i.alineas.map((a) => (
                  <div key={a.label} className="pl-4 text-sm">
                    <strong>{a.label})</strong> {a.texto}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {palavrasChave.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Palavras-chave
              </div>
              <div className="flex flex-wrap gap-1">
                {palavrasChave.map((p) => (
                  <Badge key={p} variant="outline">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {referencias.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Referências</div>
              <ul className="list-inside list-disc text-sm text-zinc-700">
                {referencias.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
