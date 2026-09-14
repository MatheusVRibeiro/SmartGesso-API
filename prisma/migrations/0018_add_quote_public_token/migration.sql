-- Migration 0018: Deep Links de Orçamento (token público)
-- Adiciona publicToken (único, para link público /o/:token) e sharedAt
-- no model Quote.

-- AlterTable
ALTER TABLE `Quote` ADD COLUMN `publicToken` VARCHAR(191) NULL;
ALTER TABLE `Quote` ADD COLUMN `sharedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Quote_publicToken_key` ON `Quote`(`publicToken`);
