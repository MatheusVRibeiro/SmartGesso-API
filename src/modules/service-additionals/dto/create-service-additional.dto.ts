import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/** DTO para criação de aditivo de serviço (ServiceAdditional). */
export class CreateServiceAdditionalDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedCost?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
