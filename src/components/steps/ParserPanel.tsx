"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { RunBar } from "./RunBar";
import type { StepPanelProps } from "./types";

interface TreeNodeData {
  id: string;
  type: string;
  label: string;
  number?: string;
  title?: string;
  text?: string;
  startLine?: number;
  endLine?: number;
  children: TreeNodeData[];
}

/** Step 4 — Parser: árvore lateral com nós clicáveis + detalhes. */
export function ParserPanel({ document, running, onRun }: StepPanelProps) {
  const [tree, setTree] = useState<TreeNodeData | null>(null);
  const [selected, setSelected] = useState<{
    node: TreeNodeData;
    parent: TreeNodeData | null;
  } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/documents/${document.id}/tree`);
    if (!res.ok) {
      setTree(null);
      return;
    }
    const data = await res.json();
    setTree(data.parserTree ?? null);
  }, [document.id]);

  useEffect(() => {
    load();
  }, [load, document.status]);

  return (
    <div className="space-y-4">
      <RunBar label="Parser" done={tree != null} running={running} onRun={onRun} />

      {tree ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Árvore Estrutural</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[36rem] overflow-auto">
              <TreeView
                node={tree}
                parent={null}
                selectedId={selected?.node.id}
                onSelect={(node, parent) => setSelected({ node, parent })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalhes do nó</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {selected ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">{selected.node.type}</Badge>
                    <span className="font-medium">{selected.node.label}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">ID:</span>{" "}
                    <code className="rounded bg-zinc-100 px-1">{selected.node.id}</code>
                  </div>
                  {selected.parent && (
                    <div>
                      <span className="text-zinc-500">Pai:</span>{" "}
                      {selected.parent.label}{" "}
                      <Badge variant="outline">{selected.parent.type}</Badge>
                    </div>
                  )}
                  <div>
                    <span className="text-zinc-500">Filhos:</span>{" "}
                    {selected.node.children.length}
                  </div>
                  {selected.node.startLine != null && (
                    <div>
                      <span className="text-zinc-500">Linhas:</span>{" "}
                      {selected.node.startLine}
                      {selected.node.endLine !== selected.node.startLine
                        ? `–${selected.node.endLine}`
                        : ""}
                    </div>
                  )}
                  {selected.node.title && (
                    <div>
                      <span className="text-zinc-500">Título:</span>{" "}
                      {selected.node.title}
                    </div>
                  )}
                  {selected.node.text && (
                    <div>
                      <div className="mb-1 text-zinc-500">Texto:</div>
                      <div className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-3 text-xs leading-5">
                        {selected.node.text}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-zinc-500">
                  Clique em um nó da árvore para ver os detalhes.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-sm text-zinc-500">
          Execute o Parser para construir a árvore hierárquica.
        </div>
      )}
    </div>
  );
}

const NODE_ICONS: Record<string, string> = {
  DOCUMENT: "📜",
  CAPITULO: "📖",
  SECAO: "📑",
  SUBSECAO: "📄",
  ARTIGO: "⚖️",
  CAPUT: "¶",
  PARAGRAFO: "§",
  INCISO: "Ⅰ",
  ALINEA: "a)",
  ITEM: "1.",
};

function TreeView({
  node,
  parent,
  selectedId,
  onSelect,
  depth = 0,
}: {
  node: TreeNodeData;
  parent: TreeNodeData | null;
  selectedId?: string;
  onSelect: (node: TreeNodeData, parent: TreeNodeData | null) => void;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-sm hover:bg-zinc-100 ${
          selectedId === node.id ? "bg-indigo-50 text-indigo-800" : ""
        }`}
        style={{ paddingLeft: depth * 16 }}
        onClick={() => onSelect(node, parent)}
      >
        {hasChildren ? (
          <button
            className="text-zinc-400"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        <span className="text-xs">{NODE_ICONS[node.type] ?? "•"}</span>
        <span className="truncate font-medium">{node.label}</span>
        {node.title && (
          <span className="truncate text-xs text-zinc-500">— {node.title}</span>
        )}
      </div>
      {open &&
        node.children.map((child) => (
          <TreeView
            key={child.id}
            node={child}
            parent={node}
            selectedId={selectedId}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}
