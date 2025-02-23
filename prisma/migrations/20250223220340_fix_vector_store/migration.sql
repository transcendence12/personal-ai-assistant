/*
  Warnings:

  - You are about to drop the column `content` on the `vectorstore_documents` table. All the data in the column will be lost.
  - Added the required column `text` to the `vectorstore_documents` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "vectorstore_documents" DROP COLUMN "content",
ADD COLUMN     "text" TEXT NOT NULL;
