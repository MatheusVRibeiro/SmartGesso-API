-- CreateTable
CREATE TABLE `InventoryMovement` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `materialId` CHAR(36) NOT NULL,
    `serviceOrderId` CHAR(36) NULL,
    `type` ENUM('ENTRADA', 'SAIDA', 'RESERVA', 'CONSUMO', 'PERDA', 'AJUSTE', 'RETORNO') NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `unitCost` DECIMAL(15, 2) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `InventoryMovement_companyId_idx`(`companyId`),
    INDEX `InventoryMovement_materialId_idx`(`materialId`),
    INDEX `InventoryMovement_serviceOrderId_idx`(`serviceOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `Material`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_serviceOrderId_fkey` FOREIGN KEY (`serviceOrderId`) REFERENCES `ServiceOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;