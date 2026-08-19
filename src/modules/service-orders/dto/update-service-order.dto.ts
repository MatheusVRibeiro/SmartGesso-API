import { IsEnum, IsOptional, IsString, IsArray, ValidateNested, IsNumber, IsDateString, IsObject, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceOrderStatus } from '@prisma/client';

/** DTO para atualização de item de material de ordem de serviço. */
export class UpdateServiceOrderMaterialDto {
  @IsOptional()
  @IsString()
  id?: string; // Para identificar material existente

  @IsString()
  materialName!: string;

  @IsNumber()
  quantity!: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

/** DTO para atualização de ordem de serviço. */
export class UpdateServiceOrderDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  workId?: string;

  @IsOptional()
  @IsEnum(ServiceOrderStatus)
  status?: ServiceOrderStatus;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsDateString()
  completedDate?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  saleValue?: number;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsObject()
  checklist?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateServiceOrderMaterialDto)
  materials?: UpdateServiceOrderMaterialDto[];
}
