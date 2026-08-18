import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CompositionStatus, MeasurementApplicationType } from '@prisma/client';

/** Bases de cálculo aceitas na fórmula de um item de composição. */
export const FORMULA_BASED_ON = ['area', 'perimeter', 'length', 'unit'] as const;
export type FormulaBasedOn = (typeof FORMULA_BASED_ON)[number];

/** Fórmula de um item: quantity = total(base) × factor (ou factor fixo quando basedOn = 'unit'). */
export class CompositionFormulaDto {
  @IsNumber()
  @Min(0)
  factor!: number;

  @IsIn(FORMULA_BASED_ON)
  basedOn!: FormulaBasedOn;
}

/** Item de composição (material + fórmula de cálculo). */
export class CreateCompositionItemDto {
  @IsString()
  @IsNotEmpty()
  materialType!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => CompositionFormulaDto)
  formula!: CompositionFormulaDto;
}

/** DTO para criação de composição versionada (code + version únicos por empresa). */
export class CreateCompositionDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @IsEnum(MeasurementApplicationType)
  applicationType!: MeasurementApplicationType;

  @IsOptional()
  @IsEnum(CompositionStatus)
  status?: CompositionStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateCompositionItemDto)
  items?: CreateCompositionItemDto[];
}