import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceDto } from './create-service.dto';

/** Todos os campos opcionais para atualização parcial de um serviço. */
export class UpdateServiceDto extends PartialType(CreateServiceDto) {}