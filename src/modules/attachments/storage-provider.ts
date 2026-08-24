import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';

/**
 * Interface abstrata para provedores de armazenamento.
 * Permite trocar a implementação (local, S3, etc.) sem alterar o serviço.
 */
export interface StorageProvider {
  save(file: Buffer, path: string): Promise<string>;
  get(path: string): Promise<Buffer>;
  exists(path: string): Promise<boolean>;
  delete(path: string): Promise<void>;
}

/**
 * Implementação local do StorageProvider.
 * Salva arquivos em ./attachments-storage.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly baseDir = join(process.cwd(), 'attachments-storage');

  async save(file: Buffer, relativePath: string): Promise<string> {
    const fullPath = join(this.baseDir, relativePath);
    const dir = dirname(fullPath);
    
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(fullPath, file);
    return fullPath;
  }

  async get(path: string): Promise<Buffer> {
    const resolvedPath = path.startsWith(this.baseDir) ? path : join(this.baseDir, path);
    return readFileSync(resolvedPath);
  }

  async exists(path: string): Promise<boolean> {
    const resolvedPath = path.startsWith(this.baseDir) ? path : join(this.baseDir, path);
    return existsSync(resolvedPath);
  }

  async delete(path: string): Promise<void> {
    const resolvedPath = path.startsWith(this.baseDir) ? path : join(this.baseDir, path);
    if (existsSync(resolvedPath)) {
      unlinkSync(resolvedPath);
    }
  }
}
