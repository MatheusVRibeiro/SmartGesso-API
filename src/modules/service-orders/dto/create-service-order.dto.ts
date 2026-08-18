import { IsEnum, IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested, IsNumber, IsDateString, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceOrderStatus } from '@prisma/client';

/** DTO para criação de item de material de ordem de serviço. */
export class CreateServiceOrderMaterialDto {
  @IsString()
  @IsNotEmpty()
  materialName!: string;

  @IsNumber()
  quantity!: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

/** DTO para criação de ordem de serviço. */
export class CreateServiceOrderDto {
  @IsString()
  @IsNotEmpty()
  clientId!: string;

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
  @IsString()
  observations?: string;

  @IsOptional()
  @IsObject()
  checklist?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateServiceOrderMaterialDto)
  materials?: CreateServiceOrderMaterialDto[];
}
