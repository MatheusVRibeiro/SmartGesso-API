import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { QuoteFollowUpType } from '@prisma/client';

/** DTO para criação de follow-up comercial de orçamento (QuoteFollowUp). */
export class CreateQuoteFollowUpDto {
  /** Canal do follow-up: CALL | WHATSAPP | EMAIL | OTHER. */
  @IsEnum(QuoteFollowUpType, { message: 'type deve ser CALL, WHATSAPP, EMAIL ou OTHER' })
  @IsNotEmpty({ message: 'type é obrigatório' })
  type!: QuoteFollowUpType;

  /** Observações/roteiro do follow-up. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  notes?: string;

  /** Data/hora agendada para o follow-up. Opcional — se ausente, fica sem agendamento. */
  @IsOptional()
  @IsDateString({}, { message: 'scheduledAt deve ser uma data ISO-8601 válida' })
  scheduledAt?: string;
}
