import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * DTO para criação do deep link público do orçamento.
 * expiryDays é opcional — quando ausente, o link expira em 7 dias.
 */
export class CreatePublicShareDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  expiryDays?: number;
}
