import { IsNumber, IsOptional, IsString } from 'class-validator';

/** DTO para registro de produção (produzido/desperdiçado). */
export class RegisterProductionDto {
  @IsNumber()
  producedQty!: number;

  @IsOptional()
  @IsNumber()
  wastedQty?: number;

  @IsOptional()
  @IsString()
  status?: string;
}
