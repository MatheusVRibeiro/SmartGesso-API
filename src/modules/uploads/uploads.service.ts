import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { PrismaService } from '../../database/prisma.service';

/** Pasta base dos uploads privados (servidos APENAS via rota autenticada). */
export const UPLOADS_DIR = join(process.cwd(), 'uploads');
export const UPLOADS_PREFIX = '/uploads';

/**
 * Caminho da rota autenticada que serve os uploads (respeita o prefixo global).
 * A `url` retornada no POST aponta para cá — o download exige Bearer token.
 */
export function uploadsAuthorizedUrl(subdir: string, filename: string): string {
  const prefix = process.env.API_PREFIX ?? 'api/v1';
  return `/${prefix}/uploads/${subdir}/${filename}`;
}

/** Allowlist de MIME types aceitos (apenas imagens). */
export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/** Sanitiza o subdiretório (entityType) — apenas [a-z0-9-_], máx 32 chars. */
export function sanitizeSubdir(entityType?: string): string {
  const raw = (entityType ?? 'geral').toLowerCase();
  const clean = raw.replace(/[^a-z0-9-_]/g, '');
  return clean.slice(0, 32) || 'geral';
}

/**
 * Valida o nome de arquivo físico — apenas [A-Za-z0-9._-], sem segmentos `..`
 * (proteção contra path traversal no parâmetro de rota).
 */
export function isValidFilename(filename: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(filename) && !filename.includes('..');
}

export interface SaveUploadResult {
  /** Rota autenticada para download (requer Bearer token). */
  url: string;
  /** Id do registro Attachment criado (null em falha de persistência — modo legado). */
  attachmentId: string | null;
  filename: string;
  size: number;
  entityType: string | null;
  entityId: string | null;
}

@Injectable()
export class UploadsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Salva o arquivo em disco e cria um registro Attachment (multi-tenant).
   *
   * `storagePath` persiste a CHAVE LÓGICA `subdir/filename` (nunca caminho
   * absoluto) — é ela que autoriza o download em
   * GET /uploads/:subdir/:filename (comparação de companyId + caminho físico
   * rederivado de UPLOADS_DIR).
   *
   * Compatibilidade Mobile (V5 ETAPA 10): a resposta continua expondo `url`
   * (agora apontando para a rota autenticada) e passa a incluir `attachmentId`.
   * Se a persistência do registro falhar, o arquivo permanece servível pela
   * URL (degradação para modo legado, SEM attachmentId — o download ficará
   * 404 até o registro existir; nunca exposto sem autorização).
   */
  async save(
    companyId: string,
    userId: string,
    file: Express.Multer.File,
    entityType?: string,
    entityId?: string,
  ): Promise<SaveUploadResult> {
    const ext = file.originalname.includes('.')
      ? file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg'
      : 'jpg';
    const filename = `${randomUUID()}.${ext}`;
    const subdir = sanitizeSubdir(entityType);
    const dir = join(UPLOADS_DIR, subdir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, filename), file.buffer);
    const storageKey = `${subdir}/${filename}`;
    const url = uploadsAuthorizedUrl(subdir, filename);

    let attachmentId: string | null = null;
    try {
      const attachment = await this.prisma.attachment.create({
        data: {
          companyId,
          entityType: subdir,
          entityId: entityId ?? '',
          originalName: file.originalname,
          storagePath: storageKey,
          mimeType: file.mimetype,
          size: file.size,
          createdById: userId,
        },
      });
      attachmentId = attachment.id;
    } catch {
      // Modo legado: não falha o upload por indisponibilidade do banco.
      attachmentId = null;
    }

    return {
      url,
      attachmentId,
      filename,
      size: file.size,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
    };
  }

  /**
   * Resolve o caminho físico de um upload APENAS se autorizado:
   * (a) existe registro Attachment com a storageKey e não deletado;
   * (b) o registro pertence à empresa autenticada.
   * Registros legados (pré-migração, sem registro) são NEGADOS com null → 404,
   * pois não há como validar a empresa dona (fail-closed).
   * Retorna null também para subdir/filename com path traversal.
   */
  async resolveAuthorized(
    companyId: string,
    subdir: string,
    filename: string,
  ): Promise<{ fullPath: string; mimeType: string } | null> {
    if (sanitizeSubdir(subdir) !== subdir || !isValidFilename(filename)) {
      return null;
    }
    const attachment = await this.prisma.attachment.findFirst({
      where: { storagePath: `${subdir}/${filename}`, deletedAt: null },
    });
    if (!attachment || attachment.companyId !== companyId) {
      return null;
    }
    const fullPath = join(UPLOADS_DIR, subdir, filename);
    // Duplo-check de path traversal: o caminho resolvido precisa ficar dentro
    // de UPLOADS_DIR (mesma proteção do AttachmentsController).
    if (
      !fullPath.startsWith(UPLOADS_DIR + sep) &&
      !fullPath.startsWith(UPLOADS_DIR + '/')
    ) {
      return null;
    }
    return { fullPath, mimeType: attachment.mimeType };
  }
}
