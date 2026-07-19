import { IsString, IsOptional, IsDateString, IsBoolean } from 'class-validator';

/** DTO para atualização de assinatura (contrato). */
export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsDateString()
  gracePeriodEnd?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  billingType?: string;

  @IsOptional()
  @IsString()
  agreedPrice?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @IsOptional()
  @IsString()
  cancellationReason?: string;

  @IsOptional()
  @IsString()
  suspensionReason?: string;
}
