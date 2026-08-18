import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MeasurementApplicationType } from '@prisma/client';

/** DTO para criação de medição (measurement) vinculada a uma obra. */
export class CreateMeasurementDto {
  @IsString()
  @IsNotEmpty()
  environmentName!: string;

  @IsOptional()
  @IsEnum(MeasurementApplicationType)
  applicationType?: MeasurementApplicationType;

  @IsOptional()
  @IsNumber()
  length?: number;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  ceilingHeight?: number;

  /**
   * Aceito por compatibilidade, mas a API é a autoridade:
   * quando length e width estão presentes, area é SEMPRE recalculada no service.
   */
  @IsOptional()
  @IsNumber()
  area?: number;

  /**
   * Aceito por compatibilidade, mas a API é a autoridade:
   * quando length e width estão presentes, perimeter é SEMPRE recalculado no service.
   */
  @IsOptional()
  @IsNumber()
  perimeter?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  doors?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  windows?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cutouts?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  fixtures?: number;

  @IsOptional()
  @IsBoolean()
  hasCove?: boolean;

  @IsOptional()
  @IsBoolean()
  hasDropCeiling?: boolean;

  @IsOptional()
  @IsString()
  observations?: string;
}