import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductionOrderStatus } from '@prisma/client';

/** DTO para item de ordem de produção. */
export class CreateProductionOrderItemDto {
  @IsString()
  @IsNotEmpty()
  productName!: string;

  @IsNumber()
  quantity!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  producedQty?: number;

  @IsOptional()
  @IsNumber()
  wastedQty?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

/** DTO para criação de ordem de produção. */
export class CreateProductionOrderDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  workId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  responsiblePerson?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsEnum(ProductionOrderStatus)
  status?: ProductionOrderStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductionOrderItemDto)
  items!: CreateProductionOrderItemDto[];
}
