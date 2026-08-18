import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkDto } from './create-work.dto';

/** DTO para atualização parcial de obra (todos os campos opcionais). */
export class UpdateWorkDto extends PartialType(CreateWorkDto) {}