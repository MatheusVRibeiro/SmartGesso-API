import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Pasta pública onde os uploads ficam (servida estaticamente). */
export const UPLOADS_DIR = join(process.cwd(), 'uploads');
export const UPLOADS_PREFIX = '/uploads';

@Injectable()
export class UploadsService {
  /** Salva o arquivo em disco e retorna a URL pública. */
  save(file: Express.Multer.File, entityType?: string, entityId?: string) {
    const ext = file.originalname.includes('.')
      ? file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg'
      : 'jpg';
    const filename = `${randomUUID()}.${ext}`;
    const subdir = entityType?.toLowerCase() ?? 'geral';
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