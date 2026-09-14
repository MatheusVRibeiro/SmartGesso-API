import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkDto } from './create-work.dto';

/** @deprecated DTO legado — mantido para compatibilidade. */
export class UpdateWorkDto extends PartialType(CreateWorkDto) {}