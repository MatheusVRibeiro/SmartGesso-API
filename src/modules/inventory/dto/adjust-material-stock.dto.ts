import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

/** Ajuste manual de estoque: define o stockQty do material para o valor informado. */
export class AdjustMaterialStockDto {
  /** Valor FINAL do estoque após o ajuste. */
  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}