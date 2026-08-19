import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { InventoryMovementType } from '@prisma/client';

/**
 * Dados para criar um movimento de estoque.
 * companyId NUNCA vem do body — é sempre obtido do request autenticado.
 */
export class CreateInventoryMovementDto {
  @IsUUID()
  materialId!: string;

  @IsEnum(InventoryMovementType)
  type!: InventoryMovementType;

  /**
   * Quantidade do movimento.
   * Para AJUSTE, representa o valor FINAL do estoque (stockQty = quantity).
   */
  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsOptional()
  @IsUUID()
  serviceOrderId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}