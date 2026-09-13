import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Tipos de entidade que podem ter anexos privados.
 * Mantém consistência com os modelos do schema Prisma.
 */
export enum AttachmentEntityType {
  QUOTE = 'QUOTE',
  SERVICE_ORDER = 'SERVICE_ORDER',
  WORK = 'WORK',
  CLIENT = 'CLIENT',
  COMPOSITION = 'COMPOSITION',
  MEASUREMENT = 'MEASUREMENT',
  EXPENSE = 'EXPENSE',
  PRODUCTION_ORDER = 'PRODUCTION_ORDER',
  QUOTE_ENVIRONMENT = 'QUOTE_ENVIRONMENT',
}

/** DTO para upload de um anexo privado. */
export class CreateAttachmentDto {
  @IsEnum(AttachmentEntityType, {
    message: 'entityType inválido. Valores aceitos: QUOTE, SERVICE_ORDER, WORK, CLIENT, COMPOSITION, MEASUREMENT, EXPENSE, PRODUCTION_ORDER, QUOTE_ENVIRONMENT.',
  })
  entityType: AttachmentEntityType;

  @IsString()
  @IsNotEmpty({ message: 'entityId é obrigatório' })
  @MaxLength(64)
  entityId: string;
}
