-- Migration 0017: Create AuditLog table for observability
-- This table tracks all sensitive operations for audit purposes

CREATE TABLE IF NOT EXISTS `AuditLog` (
  `id` VARCHAR(36) NOT NULL,
  `companyId` VARCHAR(36) NULL,
  `actorType` VARCHAR(50) NOT NULL,
  `actorId` VARCHAR(36) NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity` VARCHAR(100) NOT NULL,
  `entityId` VARCHAR(36) NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `AuditLog_companyId_createdAt_idx` (`companyId`, `createdAt`),
  INDEX `AuditLog_entity_entityId_idx` (`entity`, `entityId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;