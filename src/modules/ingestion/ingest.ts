import { prisma } from "@/database/client";
import type { DocumentType } from "@prisma/client";

export interface UploadInput {
  name: string;
  mimeType?: string;
  buffer?: Buffer;
  pastedText?: string;
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
  const isPasted = input.pastedText != null && input.buffer == null;
  const type: DocumentType = isPasted
    ? "PASTED"
    : detectType(input.name, input.mimeType);

  return prisma.document.create({
    data: {
      name: input.name,
      type,
      mimeType: input.mimeType,
      sizeBytes: input.buffer?.length ?? input.pastedText?.length ?? 0,
      // View sobre o mesmo buffer (sem copiar) — só pra bater com o tipo
      // Uint8Array<ArrayBuffer> que o Prisma espera. ArrayBuffer.slice() (usado
      // antes) duplicava o conteúdo inteiro em memória, o que estourava o
      // limite da function em uploads grandes (~35 MB).
      originalContent: input.buffer
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
