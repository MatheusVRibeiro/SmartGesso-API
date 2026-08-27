import { IsEmail, IsString, IsOptional } from 'class-validator';

/** DTO para atualização de empresa (todas as propriedades opcionais). */
export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  document?: string;

  @IsOptional()
  @IsString()
  stateRegistration?: string;

  @IsOptional()
  @IsString()
  municipalRegistration?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
