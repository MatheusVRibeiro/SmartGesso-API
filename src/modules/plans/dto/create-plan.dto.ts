import { IsString, IsNumber, IsOptional, IsArray, Min, IsBoolean } from 'class-validator';

/** DTO para criação de plano. */
export class CreatePlanDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  billingType?: string;

  @IsString()
  defaultPrice!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsers?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStorageMb?: number;

  @IsOptional()
  @IsArray()
  features?: string[];

  @IsOptional()
  @IsBoolean()
  showSmartGessoBrand?: boolean;

  @IsOptional()
  @IsString()
  status?: string;
}
