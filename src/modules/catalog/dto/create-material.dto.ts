import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CatalogItemStatus } from '@prisma/client';

/** Dados para criação de um material no catálogo da empresa. */
export class CreateMaterialDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQty?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockQty?: number;

  @IsOptional()
  @IsEnum(CatalogItemStatus)
  status?: CatalogItemStatus;
}