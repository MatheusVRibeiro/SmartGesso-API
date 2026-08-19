import { IsNumber, Min } from 'class-validator';

/** DTO para registro do resultado final de uma ordem de serviço (custo × venda). */
export class RegisterServiceOrderResultDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  saleValue!: number;
}