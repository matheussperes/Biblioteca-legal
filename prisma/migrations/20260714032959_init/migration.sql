-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PDF', 'DOCX', 'TXT', 'HTML', 'MARKDOWN', 'PASTED');

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('UPLOADED', 'EXTRACTED', 'CLEANED', 'TOKENIZED', 'PARSED', 'TREE_CREATED', 'CHUNKED', 'ENRICHED', 'EMBEDDED', 'INDEXED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "originalContent" BYTEA,
    "pastedText" TEXT,
    "status" "PipelineStatus" NOT NULL DEFAULT 'UPLOADED',
    "extractedText" TEXT,
    "cleanedText" TEXT,
    "structureJson" JSONB,
    "extractionMeta" JSONB,
    "cleaningStats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "startLine" INTEGER NOT NULL,
    "endLine" INTEGER NOT NULL,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "title" TEXT,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chapterId" TEXT,
    "index" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "title" TEXT,
    "isSubsection" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chapterId" TEXT,
    "sectionId" TEXT,
    "index" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "caput" TEXT NOT NULL,
    "fullText" TEXT NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paragraphs" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "paragraphs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incisos" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "articleId" TEXT,
    "paragraphId" TEXT,
    "index" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "incisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alineas" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "incisoId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "items" JSONB,

    CONSTRAINT "alineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "articleId" TEXT,
    "index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "charCount" INTEGER NOT NULL,
    "part" INTEGER NOT NULL DEFAULT 1,
    "totalParts" INTEGER NOT NULL DEFAULT 1,
    "originArticle" TEXT,
    "originChapter" TEXT,
    "originSection" TEXT,
    "enrichment" JSONB,
    "enrichmentPrompt" TEXT,
    "enrichmentResponse" TEXT,
    "enrichmentModel" TEXT,
    "enrichmentDurationMs" INTEGER,
    "enrichmentCostUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embeddings" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "vector" vector(1536),
    "model" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "indexed" BOOLEAN NOT NULL DEFAULT false,
    "indexedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_logs" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_jobs" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "meta" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "tokens_documentId_index_idx" ON "tokens"("documentId", "index");

-- CreateIndex
CREATE INDEX "tokens_documentId_type_idx" ON "tokens"("documentId", "type");

-- CreateIndex
CREATE INDEX "chapters_documentId_idx" ON "chapters"("documentId");

-- CreateIndex
CREATE INDEX "sections_documentId_idx" ON "sections"("documentId");

-- CreateIndex
CREATE INDEX "articles_documentId_idx" ON "articles"("documentId");

-- CreateIndex
CREATE INDEX "paragraphs_documentId_idx" ON "paragraphs"("documentId");

-- CreateIndex
CREATE INDEX "paragraphs_articleId_idx" ON "paragraphs"("articleId");

-- CreateIndex
CREATE INDEX "incisos_documentId_idx" ON "incisos"("documentId");

-- CreateIndex
CREATE INDEX "alineas_documentId_idx" ON "alineas"("documentId");

-- CreateIndex
CREATE INDEX "chunks_documentId_index_idx" ON "chunks"("documentId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "embeddings_chunkId_key" ON "embeddings"("chunkId");

-- CreateIndex
CREATE INDEX "embeddings_documentId_idx" ON "embeddings"("documentId");

-- CreateIndex
CREATE INDEX "pipeline_logs_documentId_createdAt_idx" ON "pipeline_logs"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "processing_jobs_documentId_createdAt_idx" ON "processing_jobs"("documentId", "createdAt");

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paragraphs" ADD CONSTRAINT "paragraphs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paragraphs" ADD CONSTRAINT "paragraphs_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incisos" ADD CONSTRAINT "incisos_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incisos" ADD CONSTRAINT "incisos_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incisos" ADD CONSTRAINT "incisos_paragraphId_fkey" FOREIGN KEY ("paragraphId") REFERENCES "paragraphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alineas" ADD CONSTRAINT "alineas_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alineas" ADD CONSTRAINT "alineas_incisoId_fkey" FOREIGN KEY ("incisoId") REFERENCES "incisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_logs" ADD CONSTRAINT "pipeline_logs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
