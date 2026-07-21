import { Prisma } from "@prisma/client";
import { prisma } from "@/database/client";
import type {
  ExplainabilityTrace,
  ExtractedEntities,
  GeneratedAnswer,
  QuestionCategory,
  RetrievedChunk,
} from "@/shared/rag-types";

export async function createConversation(title?: string) {
  return prisma.conversation.create({ data: { title } });
}

/** Garante uma conversa válida — cria uma nova quando o id não é informado ou não existe. */
export async function ensureConversation(conversationId?: string | null) {
  if (conversationId) {
    const existing = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (existing) return existing;
  }
  return createConversation();
}

export interface PersistExchangeInput {
  conversationId: string;
  questionText: string;
  category: QuestionCategory;
  categoryConfidence: number;
  entities: ExtractedEntities;
  classificationPrompt: string;
  classificationRaw: string;
  classificationModel: string;
  entityPrompt: string;
  entityRaw: string;
  entityModel: string;
  vectorStage: RetrievedChunk[];
  metadataStage: RetrievedChunk[];
  referenceStage: RetrievedChunk[];
  rerankStage: RetrievedChunk[];
  rerankPrompt: string;
  rerankRaw: string;
  generationPrompt: string;
  generationRaw: string;
  answer: GeneratedAnswer;
  model: string;
  temperature: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  durationMs: number;
  insufficientEvidence: boolean;
  trace: ExplainabilityTrace;
}

/** Salva pergunta, resposta, recuperações e histórico de prompts de uma troca completa. */
export async function persistExchange(input: PersistExchangeInput) {
  const questionCount = await prisma.question.count({
    where: { conversationId: input.conversationId },
  });

  const question = await prisma.question.create({
    data: {
      conversationId: input.conversationId,
      index: questionCount,
      text: input.questionText,
      category: input.category,
      categoryConfidence: input.categoryConfidence,
      entities: input.entities as unknown as Prisma.InputJsonValue,
    },
  });

  const promptRows: Prisma.PromptHistoryCreateManyInput[] = [
    {
      questionId: question.id,
      stage: "CLASSIFICATION",
      prompt: input.classificationPrompt,
      rawResponse: input.classificationRaw,
      model: input.classificationModel,
    },
    {
      questionId: question.id,
      stage: "ENTITY_EXTRACTION",
      prompt: input.entityPrompt,
      rawResponse: input.entityRaw,
      model: input.entityModel,
    },
  ];
  if (input.rerankPrompt) {
    promptRows.push({
      questionId: question.id,
      stage: "RERANK",
      prompt: input.rerankPrompt,
      rawResponse: input.rerankRaw,
      model: input.model,
    });
  }
  promptRows.push({
    questionId: question.id,
    stage: "GENERATION",
    prompt: input.generationPrompt,
    rawResponse: input.generationRaw,
    model: input.model,
  });
  await prisma.promptHistory.createMany({ data: promptRows });

  const retrievalRows: Prisma.RetrievalCreateManyInput[] = [];
  const pushStage = (stage: string, chunks: RetrievedChunk[]) => {
    chunks.forEach((c, i) => {
      retrievalRows.push({
        questionId: question.id,
        stage,
        rank: i,
        chunkId: c.chunkId,
        score: stage === "RERANK" ? c.rerankScore : c.distance,
        reason: c.reason,
      });
    });
  };
  pushStage("VECTOR", input.vectorStage);
  pushStage("METADATA", input.metadataStage);
  pushStage("REFERENCE", input.referenceStage);
  pushStage("RERANK", input.rerankStage);
  if (retrievalRows.length > 0) await prisma.retrieval.createMany({ data: retrievalRows });

  const answer = await prisma.answer.create({
    data: {
      questionId: question.id,
      resumoExecutivo: input.answer.resumoExecutivo,
      fundamentacao: input.answer.fundamentacao,
      artigosUtilizados: input.answer.artigosUtilizados as unknown as Prisma.InputJsonValue,
      referenciasCruzadas: input.answer.referenciasCruzadas as unknown as Prisma.InputJsonValue,
      observacoes: input.answer.observacoes,
      nivelConfianca: input.answer.nivelConfianca,
      hasConflict: input.answer.hasConflict,
      conflictDetails: input.answer.conflictDetails as unknown as Prisma.InputJsonValue,
      insufficientEvidence: input.insufficientEvidence,
      model: input.model,
      temperature: input.temperature,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      costUsd: input.costUsd,
      durationMs: input.durationMs,
      trace: input.trace as unknown as Prisma.InputJsonValue,
    },
  });

  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
  });
  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: {
      updatedAt: new Date(),
      title: conversation?.title ?? input.questionText.slice(0, 80),
    },
  });

  return { question, answer };
}

export async function listConversations() {
  return prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      questions: { orderBy: { index: "asc" }, take: 1, select: { text: true } },
      _count: { select: { questions: true } },
    },
  });
}

export async function getConversation(id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { index: "asc" },
        include: { answer: true },
      },
    },
  });
}

export async function getAnswer(answerId: string) {
  return prisma.answer.findUnique({
    where: { id: answerId },
    include: { question: true, feedback: true },
  });
}

export async function getQuestionRetrievals(questionId: string) {
  return prisma.retrieval.findMany({
    where: { questionId },
    orderBy: [{ stage: "asc" }, { rank: "asc" }],
    include: { chunk: { include: { article: true, document: true } } },
  });
}
