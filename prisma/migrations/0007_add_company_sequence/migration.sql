-- ETAPA 4: Numeração concorrente segura
-- Cria a tabela CompanySequence e faz backfill a partir dos números
-- já existentes em Quote (quoteNumber) e ServiceOrder (code), sem perder
-- a numeração atual de cada tenant.

-- CreateTable
CREATE TABLE `CompanySequence` (
    `companyId` CHAR(36) NOT NULL,
    `entityType` ENUM('QUOTE', 'SERVICE_ORDER') NOT NULL,
    `currentValue` INT NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CompanySequence_companyId_idx`(`companyId`),
    PRIMARY KEY (`companyId`, `entityType`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CompanySequence` ADD CONSTRAINT `CompanySequence_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: popula a sequência a partir do maior número já utilizado por empresa.
-- Usa GREATEST para garantir idempotência — se a linha já existir (ex.: migration
-- reexecutida), nunca sobrescrevemos um currentValue maior.
INSERT INTO CompanySequence (companyId, entityType, currentValue, createdAt, updatedAt)
SELECT companyId, 'QUOTE', COALESCE(MAX(quoteNumber), 0), NOW(), NOW()
FROM Quote
WHERE deletedAt IS NULL
GROUP BY companyId
ON DUPLICATE KEY UPDATE
  currentValue = GREATEST(currentValue, VALUES(currentValue));

INSERT INTO CompanySequence (companyId, entityType, currentValue, createdAt, updatedAt)
SELECT companyId, 'SERVICE_ORDER', COALESCE(MAX(code), 0), NOW(), NOW()
FROM ServiceOrder
WHERE deletedAt IS NULL
GROUP BY companyId
ON DUPLICATE KEY UPDATE
  currentValue = GREATEST(currentValue, VALUES(currentValue));
