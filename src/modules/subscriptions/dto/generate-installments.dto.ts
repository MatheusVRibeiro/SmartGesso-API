import { IsNumber, IsString, IsOptional, IsDateString, Min } from 'class-validator';

/** DTO para geração de parcelas de uma assinatura. */
export class GenerateInstallmentsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  count?: number;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsDateString()
  firstDueDate?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
