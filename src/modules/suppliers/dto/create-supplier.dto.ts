import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/** DTO para criação de fornecedor (ETAPA 10 — Fornecedores e Compras). */
export class CreateSupplierDto {
  @IsString()
  @MinLength(2, { message: 'name deve ter pelo menos 2 caracteres' })
  name!: string;

  @IsOptional()
  @IsString()
  cnpjCpf?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'email inválido' })
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
