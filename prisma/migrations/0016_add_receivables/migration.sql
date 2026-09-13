-- CreateEnum
CREATE TYPE `ServiceReceivableStatus` AS ENUM ('PENDING', 'RECEIVED', 'PARTIAL');

-- CreateEnum
CREATE TYPE `ReceivableInstallmentStatus` AS ENUM ('PENDING', 'PAID', 'OVERDUE');

-- CreateTable
CREATE TABLE `ServiceReceivable` (
    `id` CHAR(36) NOT NULL,
    `companyId` CHAR(36) NOT NULL,
    `serviceOrderId` CHAR(36) NOT NULL,
    `total` DECIMAL(15, 2) NOT NULL,
    `status` ENUM('PENDING', 'RECEIVED', 'PARTIAL') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ServiceReceivable_companyId_serviceOrderId_idx`(`companyId`, `serviceOrderId`),
    INDEX `ServiceReceivable_companyId_idx`(`companyId`),
    INDEX `ServiceReceivable_serviceOrderId_idx`(`serviceOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReceivableInstallment` (
    `id` CHAR(36) NOT NULL,
    `receivableId` CHAR(36) NOT NULL,
    `installmentNumber` INTEGER NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'OVERDUE') NOT NULL DEFAULT 'PENDING',
    `paidAt` DATETIME(3) NULL,
    `paymentId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReceivableInstallment_receivableId_idx`(`receivableId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ServiceReceivable` ADD CONSTRAINT `ServiceReceivable_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceReceivable` ADD CONSTRAINT `ServiceReceivable_serviceOrderId_fkey` FOREIGN KEY (`serviceOrderId`) REFERENCES `ServiceOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReceivableInstallment` ADD CONSTRAINT `ReceivableInstallment_receivableId_fkey` FOREIGN KEY (`receivableId`) REFERENCES `ServiceReceivable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
