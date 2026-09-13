-- AlterTable
ALTER TABLE `ServiceOrder` ADD COLUMN `pauseReason` TEXT NULL,
    ADD COLUMN `etapas` JSON NULL,
    ADD COLUMN `needsProduction` BOOLEAN NOT NULL DEFAULT false;
