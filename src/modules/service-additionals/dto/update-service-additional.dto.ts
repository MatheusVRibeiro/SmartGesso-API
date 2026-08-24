import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/** DTO para atualização de aditivo de serviço. Restringe a campos editáveis em DRAFT. */
export class UpdateServiceAdditionalDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedCost?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
