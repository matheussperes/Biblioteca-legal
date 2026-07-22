import { prisma } from "@/database/client";
import type { DocumentType } from "@prisma/client";

export interface UploadInput {
  name: string;
  mimeType?: string;
  buffer?: Buffer;
  pastedText?: string;
  /** Arquivo já enviado ao Supabase Storage — usado em vez de `buffer` para não duplicar o conteúdo no Postgres. */
  storagePath?: string;
  /** Necessário junto com `storagePath`, já que o servidor não baixa o arquivo para medi-lo. */
  sizeBytes?: number;
}

/** Detecta o tipo do documento pela extensão/mime. */
export function detectType(name: string, mimeType?: string): DocumentType {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") return "PDF";
  if (
    lower.endsWith(".docx") ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "DOCX";
  if (lower.endsWith(".html") || lower.endsWith(".htm") || mimeType === "text/html")
    return "HTML";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "MARKDOWN";
  if (lower.endsWith(".txt") || mimeType === "text/plain") return "TXT";
  return "TXT";
}

/**
 * Tela 1 — Upload.
 * Salva o documento original (arquivo ou texto colado) com status UPLOADED.
 */
export async function createDocument(input: UploadInput) {
  const isPasted = input.pastedText != null && input.buffer == null && input.storagePath == null;
  const type: DocumentType = isPasted
    ? "PASTED"
    : detectType(input.name, input.mimeType);

  return prisma.document.create({
    data: {
      name: input.name,
      type,
      mimeType: input.mimeType,
      sizeBytes: input.buffer?.length ?? input.sizeBytes ?? input.pastedText?.length ?? 0,
      // Arquivos que passaram pelo relay de upload (Supabase Storage) ficam só
      // lá — guardar os bytes também no Postgres estourava a memória da
      // function em uploads grandes (~35 MB, ver commit anterior). Só o fluxo
      // multipart legado (arquivos pequenos, sem passar pelo Storage) ainda
      // grava em originalContent.
      storagePath: input.storagePath,
      originalContent:
        input.buffer && !input.storagePath
          ? new Uint8Array(
              input.buffer.buffer as ArrayBuffer,
              input.buffer.byteOffset,
              input.buffer.byteLength
            )
          : undefined,
      pastedText: input.pastedText,
      status: "UPLOADED",
      logs: {
        create: {
          step: "UPLOAD",
          message: `Documento "${input.name}" recebido (${type}).`,
        },
      },
    },
  });
}
