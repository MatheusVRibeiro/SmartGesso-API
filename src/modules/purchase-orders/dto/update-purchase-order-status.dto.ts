import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PurchaseOrderStatus } from '@prisma/client';

/** DTO para transição de status de pedido de compra. */
export class UpdatePurchaseOrderStatusDto {
  @IsEnum(PurchaseOrderStatus)
  @IsNotEmpty()
  status!: PurchaseOrderStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
