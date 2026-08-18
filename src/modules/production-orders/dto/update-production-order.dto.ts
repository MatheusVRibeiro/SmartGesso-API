import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductionOrderStatus } from '@prisma/client';
import { CreateProductionOrderItemDto } from './create-production-order.dto';

/** DTO para atualização de item de ordem de produção. */
export class UpdateProductionOrderItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

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

/** DTO para atualização de ordem de produção. */
export class UpdateProductionOrderDto {
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
  @IsDateString()
  completedDate?: string;

  @IsOptional()
  @IsString()
  responsiblePerson?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsEnum(ProductionOrderStatus)
  status?: ProductionOrderStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProductionOrderItemDto)
  items?: UpdateProductionOrderItemDto[];
}
