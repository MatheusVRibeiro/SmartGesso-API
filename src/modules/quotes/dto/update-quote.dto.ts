import { PartialType } from '@nestjs/mapped-types';
import { CreateQuoteDto } from './create-quote.dto';

/** DTO para atualização parcial de orçamento (todos os campos opcionais). */
export class UpdateQuoteDto extends PartialType(CreateQuoteDto) {}
