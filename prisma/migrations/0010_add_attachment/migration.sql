-- ETAPA 8: Attachment privado com autorização
-- Cria a tabela Attachment para armazenamento privado de arquivos
-- com controle de acesso por tenant (companyId) e usuário (createdById).
-- Migration não-destrutiva: apenas CREATE TABLE + FK + indexes.
-- Não altera tabelas existentes nem remove o endpoint /uploads público.

-- CreateTable
CREATE TABLE `Attachment` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `entityType` VARCHAR(64) NOT NULL,
    `entityId` VARCHAR(64) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `storagePath` VARCHAR(512) NOT NULL,
    `mimeType` VARCHAR(128) NOT NULL,
    `size` INT NOT NULL,
    `createdById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `Attachment_companyId_idx`(`companyId`),
    INDEX `Attachment_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `Attachment_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
