import { IsInt, IsNumber, Max, Min } from 'class-validator';

/**
 * DTO para definir/atualizar a meta mensal da empresa (CompanyGoal).
 *
 * A meta é única por (companyId, year, month) — PUT /goals faz upsert.
 */
export class SetGoalDto {
  /** Ano da meta (ex.: 2026). */
  @IsInt({ message: 'year deve ser um inteiro' })
  @Min(2000, { message: 'year deve estar entre 2000 e 2100' })
  @Max(2100, { message: 'year deve estar entre 2000 e 2100' })
  year!: number;

  /** Mês da meta (1-12). */
  @IsInt({ message: 'month deve ser um inteiro' })
  @Min(1, { message: 'month deve estar entre 1 e 12' })
  @Max(12, { message: 'month deve estar entre 1 e 12' })
  month!: number;

  /** Meta de volume de orçamentos (soma de `total` dos orçamentos do mês). */
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'targetQuoteAmount deve ser um número com até 2 casas decimais' },
  )
  @Min(0, { message: 'targetQuoteAmount não pode ser negativo' })
  targetQuoteAmount!: number;

  /** Meta de receita (soma de `saleValue` das OS do mês, não canceladas). */
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'targetRevenue deve ser um número com até 2 casas decimais' },
  )
  @Min(0, { message: 'targetRevenue não pode ser negativo' })
  targetRevenue!: number;

  /** Meta de quantidade de orçamentos aprovados no mês. */
  @IsInt({ message: 'targetApprovedQuotes deve ser um inteiro' })
  @Min(0, { message: 'targetApprovedQuotes não pode ser negativo' })
  targetApprovedQuotes!: number;
}
