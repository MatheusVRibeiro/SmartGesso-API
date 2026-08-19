import { IsEnum, IsOptional } from 'class-validator';
import { CompanyMemberStatus, CompanyUserRole } from '@prisma/client';

/** DTO para atualizar role/status de um membro da empresa. */
export class UpdateMemberDto {
  @IsOptional()
  @IsEnum(CompanyUserRole, { message: 'role inválida' })
  role?: CompanyUserRole;

  @IsOptional()
  @IsEnum(CompanyMemberStatus, { message: 'status inválido' })
  status?: CompanyMemberStatus;
}