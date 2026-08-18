import { PartialType } from '@nestjs/mapped-types';
import { CreateMaterialDto } from './create-material.dto';

/** Todos os campos opcionais para atualização parcial de um material. */
export class UpdateMaterialDto extends PartialType(CreateMaterialDto) {}