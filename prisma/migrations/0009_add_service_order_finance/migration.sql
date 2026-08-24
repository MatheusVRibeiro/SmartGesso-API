-- ETAPA 7: ServiceOrder como hub financeiro
-- Adiciona serviceOrderId nullable em Expense e Payment (não destrutivo).
-- Permite vincular despesas e recebimentos diretamente a uma Ordem de Serviço,
-- mantendo compatibilidade retroativa (colunas nullable, ON DELETE SET NULL).

-- AddColumn: serviceOrderId (nullable) na Expense
ALTER TABLE `Expense` ADD COLUMN `serviceOrderId` CHAR(36) NULL;

-- CreateIndex
CREATE INDEX `Expense_serviceOrderId_idx` ON `Expense`(`serviceOrderId`);

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_serviceOrderId_fkey` FOREIGN KEY (`serviceOrderId`) REFERENCES `ServiceOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddColumn: serviceOrderId (nullable) no Payment
ALTER TABLE `Payment` ADD COLUMN `serviceOrderId` CHAR(36) NULL;

-- CreateIndex
CREATE INDEX `Payment_serviceOrderId_idx` ON `Payment`(`serviceOrderId`);

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_serviceOrderId_fkey` FOREIGN KEY (`serviceOrderId`) REFERENCES `ServiceOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
