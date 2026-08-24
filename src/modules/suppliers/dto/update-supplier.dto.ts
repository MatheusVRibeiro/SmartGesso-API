import { PartialType } from '@nestjs/swagger';
import { CreateSupplierDto } from './create-supplier.dto';

/** DTO para atualização parcial de fornecedor. */
export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}
