import { IsEmail, IsString, IsOptional, IsBoolean } from 'class-validator';

/** DTO para atualização de branding da empresa. */
export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @IsOptional()
  @IsEmail()
  commercialEmail?: string;

  @IsOptional()
  @IsString()
  commercialPhone?: string;

  @IsOptional()
  @IsString()
  commercialWhatsapp?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  quoteFooter?: string;

  @IsOptional()
  @IsString()
  defaultWarrantyText?: string;

  @IsOptional()
  @IsString()
  pixKey?: string;

  @IsOptional()
  @IsString()
  bankInformation?: string;

  @IsOptional()
  @IsBoolean()
  showSmartGessoBrand?: boolean;
}
