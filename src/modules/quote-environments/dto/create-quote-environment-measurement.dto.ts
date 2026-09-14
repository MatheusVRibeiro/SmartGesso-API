import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MeasurementApplicationType } from '@prisma/client';

/** DTO para criação de medição dentro de um ambiente de orçamento (QuoteEnvironment). */
export class CreateQuoteEnvironmentMeasurementDto {
  /** Nome do ambiente (opcional: se não informado, usa o nome do ambiente pai). */
  @IsOptional()
  @IsString()
  environmentName?: string;

  @IsOptional()
  @IsEnum(MeasurementApplicationType)
  applicationType?: MeasurementApplicationType;

  @IsOptional()
  @IsNumber()
  length?: number;

  @IsOptional()
  @IsNumber()
  width?: number;

  /** Pé-direito da medição. */
  @IsOptional()
  @IsNumber()
  ceilingHeight?: number;

  /** Alias para ceilingHeight enviado por clientes mobile. */
  @IsOptional()
  @IsNumber()
  height?: number;

  /** Aceito por compatibilidade, mas a API recalcula quando length e width estão presentes. */
  @IsOptional()
  @IsNumber()
  area?: number;

  /** Aceito por compatibilidade, mas a API recalcula quando length e width estão presentes. */
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
