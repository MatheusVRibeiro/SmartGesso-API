-- ETAPA 13: Feature flags por empresa (CompanyFeatureOverride)
-- Migration não-destrutiva: apenas CREATE TABLE + FK + indexes.
-- Não altera dados existentes nem remove colunas/tabelas.
-- Não altera Plan/Subscription — features do plano continuam como estavam.

-- 1. Cria a tabela CompanyFeatureOverride
CREATE TABLE `CompanyFeatureOverride` (
    `id`          CHAR(36)      NOT NULL,
    `companyId`   CHAR(36)      NOT NULL,
    `feature`     VARCHAR(191)  NOT NULL,
    `enabled`     BOOLEAN       NOT NULL DEFAULT true,
    `updatedById` CHAR(36)      NULL,
    `createdAt`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`   DATETIME(3)   NOT NULL,

    UNIQUE INDEX `CompanyFeatureOverride_companyId_feature_key`(`companyId`, `feature`),
    INDEX `CompanyFeatureOverride_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Foreign keys (não-destrutivas — apenas referências para a nova tabela)
ALTER TABLE `CompanyFeatureOverride`
  ADD CONSTRAINT `CompanyFeatureOverride_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CompanyFeatureOverride`
  ADD CONSTRAINT `CompanyFeatureOverride_updatedById_fkey`
  FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
