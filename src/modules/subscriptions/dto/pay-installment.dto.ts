import { IsString, IsOptional, IsDateString } from 'class-validator';

/** DTO para pagamento de parcela. */
export class PayInstallmentDto {
  @IsString()
  amount!: string;

  @IsString()
  paymentMethod!: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
