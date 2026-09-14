import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { QuoteFollowUpType } from '@prisma/client';

/** DTO para atualização parcial de um follow-up (todos os campos opcionais). */
export class UpdateQuoteFollowUpDto {
  /** Canal do follow-up: CALL | WHATSAPP | EMAIL | OTHER. */
  @IsOptional()
  @IsEnum(QuoteFollowUpType, { message: 'type deve ser CALL, WHATSAPP, EMAIL ou OTHER' })
  type?: QuoteFollowUpType;

  /** Observações/roteiro do follow-up. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  notes?: string;

  /** Data/hora agendada para o follow-up. */
  @IsOptional()
  @IsDateString({}, { message: 'scheduledAt deve ser uma data ISO-8601 válida' })
  scheduledAt?: string;
}
