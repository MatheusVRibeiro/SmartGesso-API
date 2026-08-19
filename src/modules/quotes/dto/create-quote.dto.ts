import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  QuoteItemType,
  QuotePaymentMethod,
  QuoteStatus,
} from '@prisma/client';

/** Formas de pagamento aceitas no campo paymentTerms (V3). */
export const QUOTE_PAYMENT_TERMS = [
  'AVISTA',
  'AVISTA_DESCONTO',
  'ENTRADA_SALDO',
  'PARCELADO',
  'QUINZENAL',
  'MENSAL',
  'PERSONALIZADO',
] as const;

/** Endereço/local onde o serviço será executado (contexto do orçamento). */
export class LocalAddressDto {
  @IsOptional()
  @IsString()
  cep?: string;

  @IsOptional()
  @IsString()
  rua?: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsString()
  complemento?: string;

  @IsOptional()
  @IsString()
  bairro?: string;

  @IsOptional()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  referencia?: string;
}

/** DTO para cada item do orçamento. */
export class QuoteItemDto {
  @IsEnum(QuoteItemType)
  itemType!: QuoteItemType;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

/** DTO para criação de orçamento (quote). */
export class CreateQuoteDto {
  @IsUUID()
  @IsNotEmpty()
  clientId!: string;

  @IsOptional()
  @IsUUID()
  workId?: string;

  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @IsNumber()
  @Min(0)
  discount: number = 0;

  @IsNumber()
  @Min(0)
  marginPct: number = 0;

  @IsOptional()
  @IsEnum(QuotePaymentMethod)
  paymentMethod?: QuotePaymentMethod;

  @IsOptional()
  @IsString()
  @IsIn(QUOTE_PAYMENT_TERMS)
  paymentTerms?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LocalAddressDto)
  localAddress?: LocalAddressDto;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationDays?: number;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsDateString()
  deadlineDate?: string;

  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @IsOptional()
  @IsDateString()
  measurementDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  warrantyDays?: number;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items!: QuoteItemDto[];
}