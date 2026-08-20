-- AlterTable
ALTER TABLE `ServiceOrder` ADD COLUMN `quoteId` CHAR(36) NULL;

-- CreateIndex
CREATE INDEX `ServiceOrder_quoteId_idx` ON `ServiceOrder`(`quoteId`);