import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Pasta pública onde os uploads ficam (servida estaticamente). */
export const UPLOADS_DIR = join(process.cwd(), 'uploads');
export const UPLOADS_PREFIX = '/uploads';

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

@Injectable()
export class UploadsService {
  /** Salva o arquivo em disco e retorna a URL pública. */
  save(file: Express.Multer.File, entityType?: string, entityId?: string) {
    const ext = file.originalname.includes('.')
      ? file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg'
      : 'jpg';
    const filename = `${randomUUID()}.${ext}`;
    const subdir = sanitizeSubdir(entityType);
    const dir = join(UPLOADS_DIR, subdir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, filename), file.buffer);
    const url = `${UPLOADS_PREFIX}/${subdir}/${filename}`;
    return {
      url,
      filename,
      size: file.size,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
    };
  }
}