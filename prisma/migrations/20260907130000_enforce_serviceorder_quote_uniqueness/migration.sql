-- Enforce 1:1 entre Quote e ServiceOrder por empresa
-- (espelha @@unique([companyId, quoteId]) do model ServiceOrder no schema.prisma,
--  que até agora só existia no Prisma — nenhuma migration criava o UNIQUE no banco).

-- Etapa 1: deduplicação legada.
-- Para cada (companyId, quoteId) com mais de uma OS, mantém a OS mais antiga
-- (menor createdAt; desempate por id) e DESVINCULA as secundárias (quoteId = NULL).
-- Nenhuma ServiceOrder é apagada — apenas perde o vínculo com o orçamento.

UPDATE `ServiceOrder` AS `so`
JOIN (
    SELECT `s`.`id` AS `id`
    FROM `ServiceOrder` AS `s`
    WHERE `s`.`quoteId` IS NOT NULL
      AND EXISTS (
          SELECT 1
          FROM `ServiceOrder` AS `outra`
          WHERE `outra`.`companyId` = `s`.`companyId`
            AND `outra`.`quoteId`  = `s`.`quoteId`
            AND `outra`.`id`      <> `s`.`id`
            AND (
                  `outra`.`createdAt` <  `s`.`createdAt`
               OR (`outra`.`createdAt` = `s`.`createdAt` AND `outra`.`id` < `s`.`id`)
            )
      )
) AS `secundaria` ON `secundaria`.`id` = `so`.`id`
SET `so`.`quoteId` = NULL;

-- Etapa 2: índice único que garante a invariante no banco.
-- Fecha a race window entre findFirst e create no fluxo de aprovação
-- (o segundo insert concorrente passa a falhar com P2002, tratado no service).
CREATE UNIQUE INDEX `ServiceOrder_companyId_quoteId_key` ON `ServiceOrder`(`companyId`, `quoteId`);
