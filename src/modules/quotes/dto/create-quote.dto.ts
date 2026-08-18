import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
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
  observations?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items!: QuoteItemDto[];
}
