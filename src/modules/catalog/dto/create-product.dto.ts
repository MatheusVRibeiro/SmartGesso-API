import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CatalogItemStatus } from '@prisma/client';

/** Dados para criação de um produto no catálogo da empresa. */
export class CreateProductDto {
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
  @IsEnum(CatalogItemStatus)
  status?: CatalogItemStatus;
}