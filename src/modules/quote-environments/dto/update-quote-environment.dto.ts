import { PartialType } from '@nestjs/swagger';
import { CreateQuoteEnvironmentDto } from './create-quote-environment.dto';

/** DTO para atualização parcial de ambiente de orçamento. */
export class UpdateQuoteEnvironmentDto extends PartialType(
  CreateQuoteEnvironmentDto,
) {}
