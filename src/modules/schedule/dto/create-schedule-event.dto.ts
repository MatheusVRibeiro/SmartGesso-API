import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ScheduleEventStatus, ScheduleEventType } from '@prisma/client';

/** DTO para criação de evento de agenda. */
export class CreateScheduleEventDto {
  @IsEnum(ScheduleEventType)
  type!: ScheduleEventType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  clientId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  serviceOrderId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  quoteId?: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  time?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(ScheduleEventStatus)
  status?: ScheduleEventStatus;
}