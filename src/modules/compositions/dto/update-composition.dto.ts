import { PartialType } from '@nestjs/mapped-types';
import { CreateCompositionDto } from './create-composition.dto';

/** DTO para atualização parcial de composição (todos os campos opcionais). */
export class UpdateCompositionDto extends PartialType(CreateCompositionDto) {}