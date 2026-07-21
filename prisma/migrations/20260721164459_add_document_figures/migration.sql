-- CreateTable
CREATE TABLE "document_figures" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "imageBase64" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "description" TEXT,
    "ocrText" TEXT,
    "articleId" TEXT,
    "chunkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_figures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_figures_documentId_page_idx" ON "document_figures"("documentId", "page");

-- CreateIndex
CREATE INDEX "document_figures_articleId_idx" ON "document_figures"("articleId");

-- AddForeignKey
ALTER TABLE "document_figures" ADD CONSTRAINT "document_figures_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_figures" ADD CONSTRAINT "document_figures_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_figures" ADD CONSTRAINT "document_figures_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

