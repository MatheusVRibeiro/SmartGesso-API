import { IsString, IsOptional, IsDateString, IsBoolean } from 'class-validator';

/** DTO para criação de assinatura (contrato) de empresa. */
export class CreateSubscriptionDto {
  @IsString()
  planId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsString()
  agreedPrice!: string;

  @IsOptional()
  @IsString()
  billingType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}
