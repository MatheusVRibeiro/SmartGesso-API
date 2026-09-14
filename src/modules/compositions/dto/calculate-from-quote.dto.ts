import { IsEnum, IsUUID } from 'class-validator';
import { MeasurementApplicationType } from '@prisma/client';

/** DTO para calcular materiais a partir das medições dos ambientes de um orçamento. */
export class CalculateFromQuoteDto {
  @IsUUID()
  quoteId!: string;

  @IsEnum(MeasurementApplicationType)
  applicationType!: MeasurementApplicationType;
}
