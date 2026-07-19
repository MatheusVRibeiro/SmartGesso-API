import { IsEmail, IsString, IsOptional, IsObject } from 'class-validator';

/** DTO para criação de empresa pela plataforma. */
export class CreateCompanyDto {
  @IsString()
  legalName!: string;

  @IsString()
  tradeName!: string;

  @IsString()
  document!: string;

  @IsOptional()
  @IsString()
  documentType?: string;

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

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsObject()
  branding?: {
    displayName?: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    commercialEmail?: string;
    commercialPhone?: string;
    commercialWhatsapp?: string;
    showSmartGessoBrand?: boolean;
  };
}
