import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

/** DTO de uma parcela (installment) do recebimento. */
export class CreatePaymentInstallmentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsDateString()
  dueDate!: string;
}

/** DTO para criação de recebimento (payment). */
export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsOptional()
  @IsString()
  quoteId?: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  /** Quantidade de parcelas (1 = pagamento à vista). Máximo 12. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  installmentCount?: number;

  /** Parcelas customizadas (amount + dueDate). Se ausente, o valor é dividido igualmente. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentInstallmentDto)
  installments?: CreatePaymentInstallmentDto[];

  /** Ordem de serviço vinculada (opcional). Quando informado, o recebimento
   *  é contabilizado como entrada direta da OS no financial-summary. */
  @IsOptional()
  @IsString()
  serviceOrderId?: string;
}