import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { WorkStatus } from '@prisma/client';

/** @deprecated DTO legado — mantido para compatibilidade. */
export class CreateWorkDto {
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsEnum(WorkStatus)
  status?: WorkStatus;

  @IsOptional()
  @IsString()
  observations?: string;
}