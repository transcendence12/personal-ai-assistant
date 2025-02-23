-- CreateTable
CREATE TABLE "vectorstore_documents" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "embedding" vector(1536) NOT NULL,

    CONSTRAINT "vectorstore_documents_pkey" PRIMARY KEY ("id")
);
