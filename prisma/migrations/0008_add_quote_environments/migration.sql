-- ETAPA 6: QuoteEnvironment + Measurement sem Work obrigatório
-- Cria a tabela QuoteEnvironment e adiciona quoteEnvironmentId na Measurement,
-- mantendo workId (agora opcional) para compatibilidade retroativa.

-- CreateTable
CREATE TABLE `QuoteEnvironment` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `quoteId` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `order` INT NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `QuoteEnvironment_companyId_idx`(`companyId`),
    INDEX `QuoteEnvironment_quoteId_idx`(`quoteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QuoteEnvironment` ADD CONSTRAINT `QuoteEnvironment_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `QuoteEnvironment` ADD CONSTRAINT `QuoteEnvironment_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddColumn: quoteEnvironmentId (nullable) na Measurement
ALTER TABLE `Measurement` ADD COLUMN `quoteEnvironmentId` CHAR(36) NULL;

-- AlterColumn: workId passa a ser opcional (nullable) — não destrutivo
ALTER TABLE `Measurement` MODIFY `workId` CHAR(36) NULL;

-- AddForeignKey: quoteEnvironmentId -> QuoteEnvironment
ALTER TABLE `Measurement` ADD CONSTRAINT `Measurement_quoteEnvironmentId_fkey` FOREIGN KEY (`quoteEnvironmentId`) REFERENCES `QuoteEnvironment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `Measurement_quoteEnvironmentId_idx` ON `Measurement`(`quoteEnvironmentId`);
