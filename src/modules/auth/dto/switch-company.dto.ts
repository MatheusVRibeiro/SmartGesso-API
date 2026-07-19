import { IsString } from 'class-validator';

/** DTO para troca de empresa ativa. */
export class SwitchCompanyDto {
  @IsString()
  companyId!: string;
}
