import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

/** Todos os campos opcionais para atualização parcial de um produto. */
export class UpdateProductDto extends PartialType(CreateProductDto) {}