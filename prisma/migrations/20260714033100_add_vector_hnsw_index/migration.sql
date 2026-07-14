-- Índice HNSW para busca por similaridade de cosseno (Fase 2 / validação)
CREATE INDEX IF NOT EXISTS "embeddings_vector_hnsw_idx"
  ON "embeddings" USING hnsw (vector vector_cosine_ops);
