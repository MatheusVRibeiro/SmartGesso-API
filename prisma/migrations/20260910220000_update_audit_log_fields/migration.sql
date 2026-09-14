-- AlterTable AuditLog to align with schema.prisma and support both legacy and new fields
ALTER TABLE `AuditLog`
  ADD COLUMN IF NOT EXISTS `userId` VARCHAR(36) NULL AFTER `companyId`,
  ADD COLUMN IF NOT EXISTS `details` JSON NULL AFTER `entityId`,
  MODIFY COLUMN `actorType` VARCHAR(50) NULL,
  MODIFY COLUMN `metadata` JSON NULL;
