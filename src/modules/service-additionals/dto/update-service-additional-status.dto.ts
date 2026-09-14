import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ServiceAdditionalStatus } from '@prisma/client';

/** DTO para transição de status de aditivo de serviço. */
export class UpdateServiceAdditionalStatusDto {
  @IsEnum(ServiceAdditionalStatus)
  @IsNotEmpty()
  status!: ServiceAdditionalStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
