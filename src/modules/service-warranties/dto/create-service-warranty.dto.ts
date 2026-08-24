import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/** DTO para criação de garantia de ordem de serviço (ServiceWarranty). */
export class CreateServiceWarrantyDto {
  /**
   * Duração da garantia em dias a partir de hoje.
   * Deve ser maior que zero — garantia não é criada automaticamente.
   */
  @IsInt({ message: 'warrantyDays deve ser um número inteiro' })
  @Min(1, { message: 'warrantyDays deve ser maior que zero' })
  warrantyDays!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  notes?: string;
}
