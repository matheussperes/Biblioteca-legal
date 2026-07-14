"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, FileUp, UploadCloud } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
  Spinner,
} from "@/components/ui";

const ACCEPT = ".pdf,.docx,.txt,.html,.htm,.md,.markdown";

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [pastedName, setPastedName] = useState("");

  const sendFile = async (file: File) => {
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha no upload.");
      router.push(`/documents/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSending(false);
    }
  };

  const sendPasted = async () => {
    if (!pastedText.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pastedName.trim() || "Texto colado",
          pastedText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar o texto.");
      router.push(`/documents/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Novo Documento</h1>
      <p className="text-sm text-zinc-600">
        Tipos aceitos: PDF, DOCX, TXT, HTML, Markdown ou texto colado.
      </p>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-4 w-4" /> Enviar arquivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
              dragging
                ? "border-indigo-500 bg-indigo-50"
                : "border-zinc-300 hover:border-zinc-400"
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) sendFile(file);
            }}
          >
            {sending ? (
              <Spinner className="h-8 w-8" />
            ) : (
              <UploadCloud className="h-10 w-10 text-zinc-400" />
            )}
            <div className="text-sm text-zinc-600">
              Arraste e solte o documento aqui, ou{" "}
              <span className="font-medium text-indigo-600">
                clique para selecionar
              </span>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) sendFile(file);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4" /> Colar texto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Nome do documento (ex.: Lei Municipal nº 1.234/2020)"
            value={pastedName}
            onChange={(e) => setPastedName(e.target.value)}
          />
          <Textarea
            rows={12}
            placeholder="Cole aqui o texto do documento..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
          />
          <Button onClick={sendPasted} disabled={sending || !pastedText.trim()}>
            {sending ? <Spinner className="h-4 w-4" /> : null} Salvar texto
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
