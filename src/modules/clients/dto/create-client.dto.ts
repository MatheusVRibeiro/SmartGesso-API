import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ClientType } from '@prisma/client';

/** DTO para criação de cliente (Fase 2 — Clientes e Catálogo). */
export class CreateClientDto {
  @IsEnum(ClientType)
  type!: ClientType;

  @IsString()
  @MinLength(2, { message: 'name deve ter pelo menos 2 caracteres' })
  name!: string;

  @IsOptional()
  @IsString()
  document?: string;

  @IsOptional()
  @IsEmail({}, { message: 'email inválido' })
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
