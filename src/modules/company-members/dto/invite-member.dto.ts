import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CompanyUserRole } from '@prisma/client';

/** DTO para convidar um usuário para a empresa (V3 — seção 57). */
export class InviteMemberDto {
  @IsEmail({}, { message: 'email inválido' })
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'name deve ter pelo menos 2 caracteres' })
  name?: string;

  @IsEnum(CompanyUserRole, { message: 'role inválida' })
  role!: CompanyUserRole;
}