import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ServiceReturnStatus } from '@prisma/client';

/** DTO para transição de status de retorno de serviço. */
export class UpdateServiceReturnStatusDto {
  @IsEnum(ServiceReturnStatus)
  @IsNotEmpty()
  status!: ServiceReturnStatus;

  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
