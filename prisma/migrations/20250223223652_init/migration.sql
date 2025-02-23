/*
  Warnings:

  - You are about to drop the column `text` on the `vectorstore_documents` table. All the data in the column will be lost.
  - Added the required column `content` to the `vectorstore_documents` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Conversation" ALTER COLUMN "userId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "UserMemory" ALTER COLUMN "userId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "vectorstore_documents" DROP COLUMN "text",
ADD COLUMN     "content" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
