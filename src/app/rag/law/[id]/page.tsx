"use client";

import { use, useEffect, useState } from "react";
import { AlertTriangle, FileText } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Spinner } from "@/components/ui";
import { ArticleViewerModal } from "@/components/chat/ArticleViewerModal";

interface ChapterRow {
  id: string;
  label: string;
  title: string | null;
}
interface SectionRow {
  id: string;
  label: string;
  title: string | null;
  chapterId: string | null;
}
interface ArticleRow {
  id: string;
  label: string;
  chapterId: string | null;
  sectionId: string | null;
}
interface TimelineEvent {
  chunkId: string;
  articleLabel: string | null;
  tipo: "NOVA_REDACAO" | "REVOGACAO";
  trecho: string;
}
interface LawDetail {
  id: string;
  name: string;
  situacao: string;
  articleCount: number;
  createdAt: string;
  chapters: ChapterRow[];
  sections: SectionRow[];
  articles: ArticleRow[];
  timeline: TimelineEvent[];
}

export default function LawNavigationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [law, setLaw] = useState<LawDetail | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/rag/law/${id}`)
      .then((res) => res.json())
      .then(setLaw);
  }, [id]);

  if (!law) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-zinc-500">
        <Spinner /> Carregando...
      </div>
    );
  }

  const topLevelArticles = law.articles.filter((a) => !a.chapterId && !a.sectionId);
  const topLevelSections = law.sections.filter((s) => !s.chapterId);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-600" /> {law.name}
          </CardTitle>
          <Badge variant={law.situacao === "Vigente" ? "success" : "warning"}>{law.situacao}</Badge>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-zinc-500">
            {law.articleCount} artigo(s) · cadastrada em {new Date(law.createdAt).toLocaleDateString("pt-BR")}
          </p>
          <div className="space-y-3 text-sm">
            {topLevelArticles.map((a) => (
              <ArticleLink key={a.id} article={a} onSelect={setSelectedArticleId} />
            ))}
            {law.chapters.map((chapter) => (
              <div key={chapter.id}>
                <div className="font-semibold text-zinc-800">
                  {chapter.label} {chapter.title ? `— ${chapter.title}` : ""}
                </div>
                <div className="mt-1 space-y-1 pl-4">
                  {law.articles
                    .filter((a) => a.chapterId === chapter.id && !a.sectionId)
                    .map((a) => (
                      <ArticleLink key={a.id} article={a} onSelect={setSelectedArticleId} />
                    ))}
                  {law.sections
                    .filter((s) => s.chapterId === chapter.id)
                    .map((section) => (
                      <div key={section.id} className="mt-1">
                        <div className="text-xs font-medium text-zinc-600">
                          {section.label} {section.title ? `— ${section.title}` : ""}
                        </div>
                        <div className="mt-1 space-y-1 pl-4">
                          {law.articles
                            .filter((a) => a.sectionId === section.id)
                            .map((a) => (
                              <ArticleLink key={a.id} article={a} onSelect={setSelectedArticleId} />
                            ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
            {topLevelSections.map((section) => (
              <div key={section.id}>
                <div className="text-xs font-medium text-zinc-600">
                  {section.label} {section.title ? `— ${section.title}` : ""}
                </div>
                <div className="mt-1 space-y-1 pl-4">
                  {law.articles
                    .filter((a) => a.sectionId === section.id)
                    .map((a) => (
                      <ArticleLink key={a.id} article={a} onSelect={setSelectedArticleId} />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linha do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          {law.timeline.length === 0 ? (
            <p className="text-xs text-zinc-400">
              Nenhuma nova redação ou revogação detectada automaticamente nesta lei.
            </p>
          ) : (
            <ul className="space-y-2">
              {law.timeline.map((e, i) => (
                <li key={i} className="rounded border border-zinc-100 bg-zinc-50 p-2 text-xs">
                  <div className="mb-1 flex items-center gap-1.5 font-medium text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {e.tipo === "REVOGACAO" ? "Possível revogação" : "Nova redação"}
                    {e.articleLabel ? ` — ${e.articleLabel}` : ""}
                  </div>
                  <p className="text-zinc-500">{e.trecho}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ArticleViewerModal articleId={selectedArticleId} onClose={() => setSelectedArticleId(null)} />
    </div>
  );
}

function ArticleLink({
  article,
  onSelect,
}: {
  article: ArticleRow;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(article.id)}
      className="block text-indigo-600 hover:underline"
    >
      {article.label}
    </button>
  );
}
