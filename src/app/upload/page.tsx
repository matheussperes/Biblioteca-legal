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
import { readJson } from "@/shared/http-client";

const ACCEPT = ".pdf,.docx,.txt,.html,.htm,.md,.markdown";
// Limite do bucket "document-uploads" no Supabase Storage.
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [pastedName, setPastedName] = useState("");

  const sendFile = async (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `Arquivo muito grande (${(file.size / (1024 * 1024)).toFixed(1)} MB). O limite é de 100 MB.`
      );
      return;
    }
    setSending(true);
    setError(null);
    try {
      // 1) pede uma URL assinada de upload (o navegador envia o arquivo
      //    direto ao Supabase Storage — não passa pelo corpo desta rota).
      const urlRes = await fetch("/api/documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name }),
      });
      const { path, signedUrl } = await readJson<{ path: string; signedUrl: string }>(
        urlRes
      );

      // 2) envia o arquivo direto ao storage.
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error("Falha ao enviar o arquivo para o armazenamento.");
      }

      // 3) cria o documento referenciando o arquivo no storage (não baixa
      //    os bytes de volta — o arquivo fica só no Supabase Storage).
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath: path,
          name: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });
      const data = await readJson<{ id: string }>(res);
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
      const data = await readJson<{ id: string }>(res);
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
