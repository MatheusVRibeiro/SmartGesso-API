import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReceivableDto {
  @ApiProperty({ description: 'Número de parcelas' })
  @IsNotEmpty()
  @IsNumber()
  installments: number;

  @ApiProperty({ description: 'Data de vencimento da primeira parcela (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  firstDueDate: string;

  @ApiProperty({ description: 'Observações', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
