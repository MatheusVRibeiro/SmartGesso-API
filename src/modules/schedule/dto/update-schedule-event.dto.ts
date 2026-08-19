import { PartialType } from '@nestjs/swagger';
import { CreateScheduleEventDto } from './create-schedule-event.dto';

/** DTO para atualização de evento de agenda — todos os campos opcionais. */
export class UpdateScheduleEventDto extends PartialType(CreateScheduleEventDto) {}