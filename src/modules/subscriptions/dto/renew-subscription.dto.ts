import { IsDateString } from 'class-validator';

/** DTO para renovação de assinatura. */
export class RenewSubscriptionDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
