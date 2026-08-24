import { IsEnum, IsNotEmpty } from 'class-validator';
import { QuoteFollowUpStatus } from '@prisma/client';

/** DTO para transição de status de follow-up (PENDING → DONE | CANCELLED). */
export class UpdateQuoteFollowUpStatusDto {
  @IsEnum(QuoteFollowUpStatus, {
    message: 'status deve ser PENDING, DONE ou CANCELLED',
  })
  @IsNotEmpty({ message: 'status é obrigatório' })
  status!: QuoteFollowUpStatus;
}
