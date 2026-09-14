-- ETAPA 12: Follow-up Comercial de Orçamentos (QuoteFollowUp)
-- Migration não-destrutiva: apenas CREATE TABLE + FK + indexes.
-- Não altera dados existentes nem remove colunas/tabelas.
-- Não altera o modelo Quote existente — apenas adiciona a nova tabela.

-- 1. Cria a tabela QuoteFollowUp
CREATE TABLE `QuoteFollowUp` (
    `id`          CHAR(36)         NOT NULL,
    `companyId`   CHAR(36)         NOT NULL,
    `quoteId`     CHAR(36)         NOT NULL,
    `type`        ENUM('CALL', 'WHATSAPP', 'EMAIL', 'OTHER') NOT NULL,
    `notes`       TEXT             NULL,
    `scheduledAt` DATETIME(3)      NULL,
    `doneAt`      DATETIME(3)      NULL,
    `status`      ENUM('PENDING', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `createdById` CHAR(36)         NULL,
    `createdAt`   DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`   DATETIME(3)      NOT NULL,
    `deletedAt`   DATETIME(3)      NULL,

    INDEX `QuoteFollowUp_companyId_quoteId_idx`(`companyId`, `quoteId`),
    INDEX `QuoteFollowUp_companyId_idx`(`companyId`),
    INDEX `QuoteFollowUp_quoteId_idx`(`quoteId`),
    INDEX `QuoteFollowUp_status_idx`(`status`),
    INDEX `QuoteFollowUp_scheduledAt_idx`(`scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Foreign keys (não-destrutivas — apenas referências para a nova tabela)
ALTER TABLE `QuoteFollowUp`
  ADD CONSTRAINT `QuoteFollowUp_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `QuoteFollowUp`
  ADD CONSTRAINT `QuoteFollowUp_quoteId_fkey`
  FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `QuoteFollowUp`
  ADD CONSTRAINT `QuoteFollowUp_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
