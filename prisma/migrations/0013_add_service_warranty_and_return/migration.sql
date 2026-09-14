-- ETAPA 11: Garantia e Retorno de Serviço (ServiceWarranty + ServiceReturn)
-- Migration não-destrutiva: apenas CREATE TABLE + FK + indexes.
-- Não altera dados existentes nem remove colunas/tabelas.

-- 1. Cria a tabela ServiceWarranty
CREATE TABLE `ServiceWarranty` (
    `id`             CHAR(36)         NOT NULL,
    `companyId`      CHAR(36)         NOT NULL,
    `serviceOrderId` CHAR(36)         NOT NULL,
    `startDate`      DATETIME(3)      NOT NULL,
    `endDate`        DATETIME(3)      NOT NULL,
    `notes`          TEXT             NULL,
    `status`         ENUM('ACTIVE', 'EXPIRED', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt`      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`      DATETIME(3)      NOT NULL,
    `deletedAt`      DATETIME(3)      NULL,

    INDEX `ServiceWarranty_companyId_serviceOrderId_idx`(`companyId`, `serviceOrderId`),
    INDEX `ServiceWarranty_companyId_idx`(`companyId`),
    INDEX `ServiceWarranty_serviceOrderId_idx`(`serviceOrderId`),
    INDEX `ServiceWarranty_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Cria a tabela ServiceReturn
CREATE TABLE `ServiceReturn` (
    `id`             CHAR(36)         NOT NULL,
    `companyId`      CHAR(36)         NOT NULL,
    `serviceOrderId` CHAR(36)         NOT NULL,
    `warrantyId`     CHAR(36)         NULL,
    `reason`         VARCHAR(191)     NOT NULL,
    `description`    TEXT             NULL,
    `status`         ENUM('OPEN', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `resolutionNote` TEXT             NULL,
    `resolvedAt`     DATETIME(3)      NULL,
    `createdAt`      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`      DATETIME(3)      NOT NULL,
    `deletedAt`      DATETIME(3)      NULL,

    INDEX `ServiceReturn_companyId_serviceOrderId_idx`(`companyId`, `serviceOrderId`),
    INDEX `ServiceReturn_companyId_idx`(`companyId`),
    INDEX `ServiceReturn_serviceOrderId_idx`(`serviceOrderId`),
    INDEX `ServiceReturn_warrantyId_idx`(`warrantyId`),
    INDEX `ServiceReturn_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. Foreign keys (não-destrutivas — apenas referências para novas tabelas)
ALTER TABLE `ServiceWarranty`
  ADD CONSTRAINT `ServiceWarranty_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ServiceWarranty`
  ADD CONSTRAINT `ServiceWarranty_serviceOrderId_fkey`
  FOREIGN KEY (`serviceOrderId`) REFERENCES `ServiceOrder`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ServiceReturn`
  ADD CONSTRAINT `ServiceReturn_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ServiceReturn`
  ADD CONSTRAINT `ServiceReturn_serviceOrderId_fkey`
  FOREIGN KEY (`serviceOrderId`) REFERENCES `ServiceOrder`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ServiceReturn`
  ADD CONSTRAINT `ServiceReturn_warrantyId_fkey`
  FOREIGN KEY (`warrantyId`) REFERENCES `ServiceWarranty`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
