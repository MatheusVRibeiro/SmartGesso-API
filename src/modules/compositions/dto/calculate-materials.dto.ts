import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { MeasurementApplicationType } from '@prisma/client';

/** Medição de um ambiente: área pode vir direta ou derivada de length × width. */
export class MeasurementInputDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  length?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  width?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ceilingHeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  area?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  perimeter?: number;
}

/** DTO do endpoint POST /compositions/calculate. */
export class CalculateMaterialsDto {
  @IsEnum(MeasurementApplicationType)
  applicationType!: MeasurementApplicationType;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MeasurementInputDto)
  measurements!: MeasurementInputDto[];
}