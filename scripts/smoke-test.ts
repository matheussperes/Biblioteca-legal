/**
 * Smoke test do pipeline completo contra o banco real (sem OpenAI):
 * Upload → Extração → Limpeza → Tokenização → Parser → Estrutura → Chunkização.
 * Os steps 7-9 exigem OPENAI_API_KEY e são validados apenas quanto ao erro amigável.
 *
 * Uso: npx tsx scripts/smoke-test.ts
 */
import { prisma } from "../src/database/client";
import { createDocument } from "../src/modules/ingestion";
import { runStep } from "../src/modules/pipeline";
import { LEI_EXEMPLO } from "../tests/fixtures/lei-exemplo";

async function main() {
  const doc = await createDocument({
    name: "Lei de Exemplo 1.234/2020 (smoke test)",
    pastedText: LEI_EXEMPLO,
  });
  console.log(`✔ Documento criado: ${doc.id} [${doc.status}]`);

  for (const step of [
    "EXTRACTION",
    "CLEANING",
    "TOKENIZATION",
    "PARSING",
    "TREE",
    "CHUNKING",
  ] as const) {
    const result = await runStep(doc.id, step);
    const updated = await prisma.document.findUniqueOrThrow({
      where: { id: doc.id },
    });
    console.log(`✔ ${step} → status ${updated.status}`, JSON.stringify(result.meta));
  }

  const counts = {
    tokens: await prisma.token.count({ where: { documentId: doc.id } }),
    capitulos: await prisma.chapter.count({ where: { documentId: doc.id } }),
    secoes: await prisma.section.count({ where: { documentId: doc.id } }),
    artigos: await prisma.article.count({ where: { documentId: doc.id } }),
    paragrafos: await prisma.paragraph.count({ where: { documentId: doc.id } }),
    incisos: await prisma.inciso.count({ where: { documentId: doc.id } }),
    alineas: await prisma.alinea.count({ where: { documentId: doc.id } }),
    chunks: await prisma.chunk.count({ where: { documentId: doc.id } }),
    logs: await prisma.pipelineLog.count({ where: { documentId: doc.id } }),
    jobs: await prisma.processingJob.count({ where: { documentId: doc.id } }),
  };
  console.log("✔ Contagens:", counts);

  if (counts.artigos !== 5) throw new Error(`Esperava 5 artigos, veio ${counts.artigos}`);
  if (counts.chunks < 5) throw new Error(`Esperava >= 5 chunks, veio ${counts.chunks}`);

  // Step 7 sem OPENAI_API_KEY deve falhar com mensagem amigável
  if (!process.env.OPENAI_API_KEY) {
    try {
      await runStep(doc.id, "ENRICHMENT");
      throw new Error("ENRICHMENT deveria ter falhado sem OPENAI_API_KEY");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!message.includes("OPENAI_API_KEY")) throw e;
      console.log(`✔ ENRICHMENT sem chave falha graciosamente: "${message}"`);
    }
  }

  // Reprocessamento: refazer a tokenização invalida parser/chunks e retrocede o status
  await runStep(doc.id, "TOKENIZATION");
  const after = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } });
  const chunksAfter = await prisma.chunk.count({ where: { documentId: doc.id } });
  if (after.status !== "TOKENIZED" || chunksAfter !== 0) {
    throw new Error(
      `Reprocessamento incorreto: status=${after.status}, chunks=${chunksAfter}`
    );
  }
  console.log("✔ Reprocessamento incremental OK (status retrocede, artefatos invalidados)");

  await prisma.document.delete({ where: { id: doc.id } });
  console.log("✔ Smoke test concluído com sucesso.");
}

main()
  .catch((e) => {
    console.error("✘ Smoke test falhou:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
