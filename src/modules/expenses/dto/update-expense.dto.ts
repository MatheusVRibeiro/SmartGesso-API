import { PartialType } from '@nestjs/swagger';
import { CreateExpenseDto } from './create-expense.dto';

/** DTO para atualização de despesa — todos os campos opcionais. */
export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}
