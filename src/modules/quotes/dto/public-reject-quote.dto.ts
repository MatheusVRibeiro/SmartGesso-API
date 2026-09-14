import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO para rejeição pública do orçamento via deep link.
 * A nota é obrigatória (o cliente precisa justificar a rejeição).
 */
export class PublicRejectQuoteDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  note!: string;
}
