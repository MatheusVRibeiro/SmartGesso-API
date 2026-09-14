import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class UpdateInstallmentDto {
  @ApiProperty({ description: 'ID do pagamento associado', required: false })
  @IsOptional()
  @IsString()
  paymentId?: string;

  @ApiProperty({ description: 'Data do pagamento (YYYY-MM-DD)', required: false })
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
