import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ServiceWarrantyStatus } from '@prisma/client';

/** DTO para transição de status de garantia de serviço. */
export class UpdateServiceWarrantyStatusDto {
  @IsEnum(ServiceWarrantyStatus)
  @IsNotEmpty()
  status!: ServiceWarrantyStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
