import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

/** DTO para criação de retorno de ordem de serviço (ServiceReturn). */
export class CreateServiceReturnDto {
  /**
   * ID da garantia associada. Opcional — um retorno pode ser criado sem
   * garantia ativa desde que `reason` seja informado.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  warrantyId?: string;

  /** Motivo do retorno (obrigatório). */
  @IsString()
  @IsNotEmpty()
  reason!: string;

  /** Descrição detalhada do problema. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  /**
   * Quando true, indica que o retorno é coberto por garantia ativa.
   * Usado para validar a regra de negócio: retorno só é permitido com
   * garantia ativa OU motivo válido.
   */
  @IsOptional()
  @IsBoolean()
  coveredByWarranty?: boolean;
}
