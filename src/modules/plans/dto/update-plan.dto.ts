import { PartialType } from '@nestjs/mapped-types';
import { CreatePlanDto } from './create-plan.dto';

/** DTO para atualização de plano (todas as propriedades do CreatePlanDto opcionais). */
export class UpdatePlanDto extends PartialType(CreatePlanDto) {}
