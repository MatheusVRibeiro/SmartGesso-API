import { PartialType } from '@nestjs/swagger';
import { CreateQuoteEnvironmentMeasurementDto } from './create-quote-environment-measurement.dto';

/** DTO para atualização de medição dentro de um ambiente de orçamento. */
export class UpdateQuoteEnvironmentMeasurementDto extends PartialType(
  CreateQuoteEnvironmentMeasurementDto,
) {}
