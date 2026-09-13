import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/** DTO para um item de pedido de compra (ETAPA 10). */
export class CreatePurchaseOrderItemDto {
  /**
   * Referência opcional a um item de catálogo (Product, Service ou Material).
   * Quando aponta para um Material, o recebimento cria movimento de entrada
   * no inventário.
   */
  @IsOptional()
  @IsString()
  catalogItemId?: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  /**
   * Total do item. Se omitido, calculado como quantity * unitPrice.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total?: number;
}
