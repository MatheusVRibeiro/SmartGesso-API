-- ETAPA 10: Fornecedores e Compras (Supplier + PurchaseOrder)
-- Migration não-destrutiva: apenas CREATE TABLE + FK + indexes.
-- Não altera dados existentes nem remove colunas/tabelas.

-- 1. Cria a tabela Supplier
CREATE TABLE `Supplier` (
    `id`         CHAR(36)         NOT NULL,
    `companyId`  CHAR(36)         NOT NULL,
    `name`       VARCHAR(191)     NOT NULL,
    `cnpjCpf`    VARCHAR(191)     NULL,
    `phone`      VARCHAR(191)     NULL,
    `email`      VARCHAR(191)     NULL,
    `address`    TEXT             NULL,
    `notes`      TEXT             NULL,
    `createdAt`  DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`  DATETIME(3)      NOT NULL,
    `deletedAt`  DATETIME(3)      NULL,

    INDEX `Supplier_companyId_idx`(`companyId`),
    INDEX `Supplier_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Cria a tabela PurchaseOrder
CREATE TABLE `PurchaseOrder` (
    `id`             CHAR(36)         NOT NULL,
    `companyId`      CHAR(36)         NOT NULL,
    `supplierId`     CHAR(36)         NULL,
    `serviceOrderId` CHAR(36)         NULL,
    `status`         ENUM('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `total`          DECIMAL(15, 2)   NOT NULL DEFAULT 0.00,
    `notes`          TEXT             NULL,
    `createdAt`      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`      DATETIME(3)      NOT NULL,
    `deletedAt`      DATETIME(3)      NULL,

    INDEX `PurchaseOrder_companyId_idx`(`companyId`),
    INDEX `PurchaseOrder_supplierId_idx`(`supplierId`),
    INDEX `PurchaseOrder_serviceOrderId_idx`(`serviceOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. Cria a tabela PurchaseOrderItem
CREATE TABLE `PurchaseOrderItem` (
    `id`              CHAR(36)         NOT NULL,
    `purchaseOrderId` CHAR(36)         NOT NULL,
    `catalogItemId`   CHAR(36)         NULL,
    `description`     VARCHAR(191)     NOT NULL,
    `quantity`        DECIMAL(15, 3)   NOT NULL,
    `unitPrice`       DECIMAL(15, 2)   NOT NULL DEFAULT 0.00,
    `total`           DECIMAL(15, 2)   NOT NULL DEFAULT 0.00,
    `createdAt`       DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PurchaseOrderItem_purchaseOrderId_idx`(`purchaseOrderId`),
    INDEX `PurchaseOrderItem_catalogItemId_idx`(`catalogItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. Foreign keys (não-destrutivas — apenas referências para novas tabelas)
ALTER TABLE `Supplier`
  ADD CONSTRAINT `Supplier_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PurchaseOrder`
  ADD CONSTRAINT `PurchaseOrder_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PurchaseOrder`
  ADD CONSTRAINT `PurchaseOrder_supplierId_fkey`
  FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `PurchaseOrder`
  ADD CONSTRAINT `PurchaseOrder_serviceOrderId_fkey`
  FOREIGN KEY (`serviceOrderId`) REFERENCES `ServiceOrder`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `PurchaseOrderItem`
  ADD CONSTRAINT `PurchaseOrderItem_purchaseOrderId_fkey`
  FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
