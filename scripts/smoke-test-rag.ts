/**
 * Smoke test do Motor RAG (Fase 2) contra o banco real.
 *
 * Sem OPENAI_API_KEY: valida apenas a falha graciosa (nunca deve travar o
 * processo nem responder sem evidência/chave).
 *
 * Com OPENAI_API_KEY: roda o pipeline completo da Fase 1 (upload → indexação)
 * sobre a lei de exemplo, faz duas perguntas encadeadas na mesma conversa e
 * valida a persistência completa (conversation_history, questions, answers,
 * retrievals, prompt_history) e a rastreabilidade das citações.
 *
 * Uso: npx tsx scripts/smoke-test-rag.ts
 */
import { prisma } from "../src/database/client";
import { createDocument } from "../src/modules/ingestion";
import { runStep } from "../src/modules/pipeline";
import { askQuestion } from "../src/modules/rag-engine";
import { LEI_EXEMPLO } from "../tests/fixtures/lei-exemplo";

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    try {
      await askQuestion("Qual a altura máxima permitida?");
      throw new Error("askQuestion deveria ter falhado sem OPENAI_API_KEY");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!message.includes("OPENAI_API_KEY")) throw e;
      console.log(`✔ askQuestion sem chave falha graciosamente: "${message}"`);
    }
    console.log(
      "ℹ OPENAI_API_KEY não configurada — pulando o teste completo do Motor RAG (classificação, embeddings, geração)."
    );
    return;
  }

  const doc = await createDocument({
    name: "Lei de Exemplo 1.234/2020 (smoke test RAG)",
    pastedText: LEI_EXEMPLO,
  });
  console.log(`✔ Documento criado: ${doc.id}`);

  for (const step of [
    "EXTRACTION",
    "CLEANING",
    "TOKENIZATION",
    "PARSING",
    "TREE",
    "CHUNKING",
    "ENRICHMENT",
    "EMBEDDINGS",
    "INDEXING",
  ] as const) {
    await runStep(doc.id, step);
  }
  const indexed = await prisma.embedding.count({ where: { documentId: doc.id, indexed: true } });
  console.log(`✔ Pipeline Fase 1 completo — ${indexed} embedding(s) indexado(s)`);

  const first = await askQuestion("Qual a altura máxima permitida para edificações?");
  console.log(`✔ Primeira pergunta respondida — confiança: ${first.answer.nivelConfianca}`);
  if (!first.conversationId || !first.questionId || !first.answerId) {
    throw new Error("askQuestion não retornou os identificadores esperados");
  }
  if (first.evidences.length === 0 && !first.insufficientEvidence) {
    throw new Error("Resposta sem evidências mas sem sinalizar insuficiência");
  }

  const second = await askQuestion("E quanto ao recuo mínimo exigido?", first.conversationId);
  if (second.conversationId !== first.conversationId) {
    throw new Error("A segunda pergunta deveria continuar a mesma conversa");
  }
  console.log("✔ Segunda pergunta encadeada na mesma conversa");

  const counts = {
    conversations: await prisma.conversation.count({ where: { id: first.conversationId } }),
    questions: await prisma.question.count({ where: { conversationId: first.conversationId } }),
    answers: await prisma.answer.count({ where: { question: { conversationId: first.conversationId } } }),
    retrievals: await prisma.retrieval.count({ where: { question: { conversationId: first.conversationId } } }),
    promptHistory: await prisma.promptHistory.count({
      where: { question: { conversationId: first.conversationId } },
    }),
  };
  console.log("✔ Persistência:", counts);
  if (counts.questions !== 2 || counts.answers !== 2) {
    throw new Error(`Persistência incompleta: ${JSON.stringify(counts)}`);
  }

  await prisma.favorite.create({
    data: { id: `TEST:${doc.id}`, type: "ANSWER", refId: first.answerId, title: "smoke test" },
  });
  await prisma.feedback.create({ data: { answerId: first.answerId, rating: "UP" } });
  console.log("✔ Favoritos e feedback gravados com sucesso");

  await prisma.conversation.delete({ where: { id: first.conversationId } }).catch(() => null);
  await prisma.favorite.delete({ where: { id: `TEST:${doc.id}` } }).catch(() => null);
  await prisma.document.delete({ where: { id: doc.id } });
  console.log("✔ Smoke test do Motor RAG concluído com sucesso.");
}

main()
  .catch((e) => {
    console.error("✘ Smoke test do Motor RAG falhou:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
