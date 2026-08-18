import { PartialType } from '@nestjs/swagger';
import { CreateMeasurementDto } from './create-measurement.dto';

/** DTO para atualização parcial de medição (todos os campos opcionais). */
export class UpdateMeasurementDto extends PartialType(CreateMeasurementDto) {}