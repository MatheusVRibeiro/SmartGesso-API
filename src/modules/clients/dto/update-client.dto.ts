import { PartialType } from '@nestjs/swagger';
import { CreateClientDto } from './create-client.dto';

/** DTO para atualização parcial de cliente. */
export class UpdateClientDto extends PartialType(CreateClientDto) {}
