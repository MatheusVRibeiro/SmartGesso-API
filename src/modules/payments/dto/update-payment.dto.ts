import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentDto } from './create-payment.dto';

/** DTO para atualização parcial de recebimento (todos os campos opcionais). */
export class UpdatePaymentDto extends PartialType(CreatePaymentDto) {}
