import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { PrismaService } from '../../database/prisma.service';
import { StorageProvider } from './storage-provider';

/** MIME types aceitos: imagens, PDF e documentos comuns. */
export const ATTACHMENT_ALLOWED_MIME_TYPES = new Set([
  // Imagens
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
  // PDF
  'application/pdf',
  // Documentos
  'application/rtf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
]);

/** Sanitiza o subdiretório (entityType) — apenas [a-z0-9-_], máx 32 chars. */
export function sanitizeSubdir(entityType?: string): string {
  const raw = (entityType ?? 'geral').toLowerCase();
  const clean = raw.replace(/[^a-z0-9-_]/g, '');
  return clean.slice(0, 32) || 'geral';
}

/**
 * Serviço de anexos privados com isolamento por tenant (companyId).
 *
 * Regras de segurança:
 * - Todo acesso valida o `companyId` (tenant isolation).
 * - Soft delete via `deletedAt` — arquivos permanecem em disco.
 * - Download autorizado apenas via controller (res.sendFile), nunca estático.
 */
@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('StorageProvider') private readonly storage: StorageProvider,
  ) {}

  /**
   * Salva o arquivo em disco (diretório privado, isolado por tenant) e
   * cria o registro no banco.
   */
  async create(
    companyId: string,
    userId: string,
    file: Express.Multer.File,
    entityType: string,
    entityId: string,
  ) {
    if (!file || !file.mimetype) {
      throw new BadRequestException('Arquivo não enviado (campo `file`)');
    }
    if (!entityType || !entityId) {
      throw new BadRequestException('entityType e entityId são obrigatórios');
    }
    if (!ATTACHMENT_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido: ${file.mimetype}.`,
      );
    }

    const ext = file.originalname.includes('.')
      ? file.originalname.split('.').pop()?.toLowerCase() ?? 'bin'
      : 'bin';
    const filename = `${randomUUID()}.${ext}`;
    
    // Caminho relativo para o StorageProvider
    const relativePath = join(
      companyId,
      sanitizeSubdir(entityType),
      entityId,
      filename,
    );
    
    const storagePath = await this.storage.save(file.buffer, relativePath);

    return this.prisma.attachment.create({
      data: {
        companyId,
        entityType,
        entityId,
        originalName: file.originalname,
        storagePath,
        mimeType: file.mimetype,
        size: file.size,
        createdById: userId,
      },
    });
  }

  /** Lista anexos de uma entidade — apenas os não-deletados. */
  async listByEntity(
    companyId: string,
    entityType: string,
    entityId: string,
  ) {
    return this.prisma.attachment.findMany({
      where: {
        companyId,
        entityType,
        entityId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Soft delete — marca `deletedAt`. O arquivo permanece em disco. */
  async remove(companyId: string, id: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!attachment) {
      throw new NotFoundException('Anexo não encontrado');
    }

    return this.prisma.attachment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Valida o tenant (companyId) e retorna o caminho de armazenamento
   * do arquivo no disco. Lança NotFoundException se o anexo não existir
   * ou pertencer a outra empresa.
   */
  async getStoragePath(companyId: string, id: string): Promise<string> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!attachment) {
      throw new NotFoundException('Anexo não encontrado');
    }
    
    const exists = await this.storage.exists(attachment.storagePath);
    if (!exists) {
      throw new NotFoundException('Arquivo físico não encontrado');
    }
    return attachment.storagePath;
  }

  /** Busca um anexo pelo ID, validando o tenant. */
  async findOne(companyId: string, id: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!attachment) {
      throw new NotFoundException('Anexo não encontrado');
    }
    return attachment;
  }
}
