-- CreateTable
CREATE TABLE `UserSession` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NULL,
    `platformAdminId` CHAR(36) NULL,
    `activeCompanyId` CHAR(36) NULL,
    `refreshTokenHash` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NULL,
    `deviceName` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revocationReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
