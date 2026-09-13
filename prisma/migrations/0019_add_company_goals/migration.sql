-- Migration 0019: Metas mensais por empresa (CompanyGoal)
-- Não-destrutiva: apenas CREATE TABLE + FK + indexes.
-- Não altera dados existentes nem remove colunas/tabelas.

-- 1. Cria a tabela CompanyGoal
CREATE TABLE `CompanyGoal` (
    `id`                   CHAR(36)      NOT NULL,
    `companyId`            CHAR(36)      NOT NULL,
    `year`                 INT           NOT NULL,
    `month`                INT           NOT NULL,
    `targetQuoteAmount`    DECIMAL(15,2) NOT NULL,
    `targetRevenue`        DECIMAL(15,2) NOT NULL,
    `targetApprovedQuotes` INT           NOT NULL,
    `createdById`          CHAR(36)      NULL,
    `createdAt`            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`            DATETIME(3)   NOT NULL,

    UNIQUE INDEX `CompanyGoal_companyId_year_month_key`(`companyId`, `year`, `month`),
    INDEX `CompanyGoal_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Foreign keys (não-destrutivas — apenas referências para a nova tabela)
ALTER TABLE `CompanyGoal`
  ADD CONSTRAINT `CompanyGoal_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CompanyGoal`
  ADD CONSTRAINT `CompanyGoal_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
