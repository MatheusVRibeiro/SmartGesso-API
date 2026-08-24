import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de resposta — nunca expõe `storagePath` (caminho interno em disco).
 */
export class AttachmentResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'QUOTE' })
  entityType: string;

  @ApiProperty({ example: 'quote-123' })
  entityId: string;

  @ApiProperty({ example: 'orcamento.pdf' })
  originalName: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType: string;

  @ApiProperty({ example: 102400 })
  size: number;

  @ApiProperty({ example: '2026-08-24T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ nullable: true, example: null })
  deletedAt: Date | null;
}
