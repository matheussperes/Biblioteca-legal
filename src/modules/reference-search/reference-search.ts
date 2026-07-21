import { prisma } from "@/database/client";
import { vectorSearchInDocuments } from "@/modules/retrieval";
import { DEFAULT_CONFIG } from "@/shared/config";
import { normalizeText } from "@/shared/utils";
import type { RetrievedChunk } from "@/shared/rag-types";

export function extractReferenceCandidates(chunk: RetrievedChunk): string[] {
  const candidates = new Set<string>();
  const enrichment = (chunk.enrichment ?? {}) as Record<string, unknown>;
  if (Array.isArray(enrichment.referencias)) {
    for (const ref of enrichment.referencias) {
      if (typeof ref === "string" && ref.trim()) candidates.add(ref.trim());
    }
  }
  const regex = new RegExp(DEFAULT_CONFIG.regex.referenciaLegal, "gi");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(chunk.content)) !== null) {
    if (match[1]) candidates.add(match[1].trim());
    if (match.index === regex.lastIndex) regex.lastIndex += 1; // evita loop infinito
  }
  return [...candidates];
}

/** Números com 4+ dígitos citados no texto (ex.: "10.257" em "Lei nº 10.257/2001") — sinal forte de identidade. */
function extractSignificantNumbers(text: string): Set<string> {
  const matches = text.match(/\d[\d.]*\d|\d+/g) ?? [];
  return new Set(matches.map((m) => m.replace(/\./g, "")).filter((n) => n.length >= 4));
}

/** Compara uma referência textual ("Lei Federal nº 10.257/2001", "LUOS"...) com o nome de um documento. */
export function referenceMatchesDocument(reference: string, documentName: string): boolean {
  const refN = normalizeText(reference);
  const docN = normalizeText(documentName);
  if (!refN || !docN) return false;
  if (refN.includes(docN) || docN.includes(refN)) return true;

  // números de lei/decreto com 4+ dígitos em comum (robusto a formatação de data diferente)
  const refNumbers = extractSignificantNumbers(refN);
  for (const n of refNumbers) {
    if (extractSignificantNumbers(docN).has(n)) return true;
  }

  const refTokens = new Set(refN.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 4));
  const docTokens = docN.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 4);
  if (docTokens.length === 0) return false;
  const overlap = docTokens.filter((t) => refTokens.has(t));
  return overlap.length > 0 && overlap.length / docTokens.length >= 0.4;
}

export interface ReferenceMatch {
  reference: string;
  originChunk: RetrievedChunk;
  documentId: string;
  documentName: string;
}

/**
 * Terceira etapa da recuperação — Busca por Referências Cruzadas.
 * Se um artigo mencionar outra lei/decreto/norma, os documentos referenciados
 * são recuperados automaticamente — mesmo que não tenham aparecido na busca vetorial.
 */
export async function findCrossReferences(chunks: RetrievedChunk[]): Promise<ReferenceMatch[]> {
  const currentDocumentIds = new Set(chunks.map((c) => c.documentId));
  const documents = await prisma.document.findMany({ select: { id: true, name: true } });

  const matches: ReferenceMatch[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const candidates = extractReferenceCandidates(chunk);
    for (const reference of candidates) {
      for (const doc of documents) {
        if (currentDocumentIds.has(doc.id)) continue; // já está no conjunto principal
        if (!referenceMatchesDocument(reference, doc.name)) continue;
        const key = `${doc.id}::${reference}`;
        if (seen.has(key)) continue;
        seen.add(key);
        matches.push({ reference, originChunk: chunk, documentId: doc.id, documentName: doc.name });
      }
    }
  }
  return matches;
}

/** Recupera os chunks mais relevantes dos documentos referenciados encontrados acima. */
export async function retrieveCrossReferencedChunks(
  matches: ReferenceMatch[],
  queryVector: number[],
  limitPerDocument = 2
): Promise<RetrievedChunk[]> {
  const documentIds = [...new Set(matches.map((m) => m.documentId))];
  if (documentIds.length === 0) return [];
  const chunks = await vectorSearchInDocuments(queryVector, documentIds, limitPerDocument);

  return chunks.map((chunk) => {
    const match = matches.find((m) => m.documentId === chunk.documentId);
    return {
      ...chunk,
      stage: "REFERENCE" as const,
      reason: match
        ? `Referência cruzada — citada em "${match.originChunk.documentName}"${
            match.originChunk.articleLabel ? ` (${match.originChunk.articleLabel})` : ""
          }: "${match.reference}"`
        : "Referência cruzada",
    };
  });
}
