-- ETAPA 9: Aditivos de Serviço (ServiceAdditional)
-- Migration não-destrutiva: apenas CREATE TABLE + ALTER ENUM + FK + indexes.
-- Não altera dados existentes nem remove colunas/tabelas.

-- 1. Adiciona SERVICE_ADDITIONAL ao enum SequenceEntityType (não destrutivo)
ALTER TABLE `CompanySequence`
  MODIFY COLUMN `entityType` ENUM('QUOTE', 'SERVICE_ORDER', 'SERVICE_ADDITIONAL') NOT NULL;

-- 2. Cria a tabela ServiceAdditional
CREATE TABLE `ServiceAdditional` (
    `id`             CHAR(36)         NOT NULL,
    `companyId`      CHAR(36)         NOT NULL,
    `serviceOrderId` CHAR(36)         NOT NULL,
    `code`           INT              NOT NULL,
    `description`    VARCHAR(191)     NOT NULL,
    `amount`         DECIMAL(15, 2)   NOT NULL,
    `estimatedCost`  DECIMAL(15, 2)   NULL,
    `status`         ENUM('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `approvedAt`     DATETIME(3)      NULL,
    `rejectedAt`     DATETIME(3)      NULL,
    `notes`          TEXT             NULL,
    `createdById`    CHAR(36)         NULL,
    `createdAt`      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`      DATETIME(3)      NOT NULL,
    `deletedAt`      DATETIME(3)      NULL,

    INDEX `ServiceAdditional_companyId_serviceOrderId_idx`(`companyId`, `serviceOrderId`),
    INDEX `ServiceAdditional_companyId_idx`(`companyId`),
    INDEX `ServiceAdditional_serviceOrderId_idx`(`serviceOrderId`),
    INDEX `ServiceAdditional_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. Foreign keys
ALTER TABLE `ServiceAdditional`
  ADD CONSTRAINT `ServiceAdditional_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ServiceAdditional`
  ADD CONSTRAINT `ServiceAdditional_serviceOrderId_fkey`
  FOREIGN KEY (`serviceOrderId`) REFERENCES `ServiceOrder`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ServiceAdditional`
  ADD CONSTRAINT `ServiceAdditional_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
