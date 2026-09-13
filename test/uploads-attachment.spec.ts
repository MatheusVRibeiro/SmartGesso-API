import { join } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';
import {
  INestApplication,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { Response } from 'express';
import { PrismaService } from '../src/database/prisma.service';
import {
  UPLOADS_DIR,
  UploadsService,
  uploadsAuthorizedUrl,
  isValidFilename,
} from '../src/modules/uploads/uploads.service';
import { UploadsController } from '../src/modules/uploads/uploads.controller';
import { UploadsModule } from '../src/modules/uploads/uploads.module';
import { PrismaModule } from '../src/database/prisma.module';
import { JwtAuthGuard } from '../src/modules/core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../src/modules/core/guards/active-company.guard';
import { CompanyAccessGuard } from '../src/modules/core/guards/company-access.guard';

/**
 * V5 ETAPA 10 — uploads privados (fecha o gap de leitura pública P1.12).
 *
 * - POST /uploads cria o arquivo em disco E um registro Attachment com
 *   companyId da empresa autenticada (resposta mantém `url` por compatibilidade
 *   com o Mobile atual e passa a incluir `attachmentId`).
 * - GET /uploads/:subdir/:filename substitui o useStaticAssets (removido do
 *   main.ts): 401 sem token, 404 de outra empresa/legado, 200 da empresa certa.
 *
 * PrismaService é mockado — nenhum banco é acessado. O disco é usado de forma
 * controlada (arquivo real criado no POST e removido no cleanup).
 */

const COMPANY_ID = 'company-1';
const OTHER_COMPANY_ID = 'company-2';
const USER_ID = 'user-1';

const mockFile: Express.Multer.File = {
  originalname: 'foto-obra.jpg',
  mimetype: 'image/jpeg',
  size: 2048,
  buffer: Buffer.from('conteudo-da-foto'),
  encoding: '7bit',
  fieldname: 'file',
  destination: '',
  filename: '',
  path: '',
  stream: null as any,
};

/** Caminhos criados em disco durante os testes — removidos no cleanup. */
const createdFiles: string[] = [];

function cleanupCreatedFiles() {
  for (const f of createdFiles.splice(0)) {
    try {
      if (existsSync(f)) unlinkSync(f);
    } catch {
      /* best-effort */
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// UploadsService — persistência do Attachment + resolução autorizada
// ─────────────────────────────────────────────────────────────────────────

describe('UploadsService (V5 ETAPA 10)', () => {
  let service: UploadsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      attachment: {
        create: jest.fn().mockResolvedValue({ id: 'att-uuid-1' }),
        findFirst: jest.fn(),
      },
    };
    service = new UploadsService(prisma);
  });

  afterEach(cleanupCreatedFiles);

  describe('save', () => {
    it('cria registro Attachment com companyId, storageKey, mimeType e size', async () => {
      const result = await service.save(
        COMPANY_ID,
        USER_ID,
        mockFile,
        'works',
        'w-00000001',
      );

      expect(prisma.attachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            entityType: 'works',
            entityId: 'w-00000001',
            originalName: 'foto-obra.jpg',
            mimeType: 'image/jpeg',
            size: 2048,
            createdById: USER_ID,
          }),
        }),
      );

      const data = (prisma.attachment.create.mock.calls[0] as any)[0].data;
      // storagePath persiste a CHAVE LÓGICA subdir/filename (não caminho absoluto)
      expect(data.storagePath).toMatch(/^works\/[a-f0-9-]+\.jpg$/);
      expect(result.attachmentId).toBe('att-uuid-1');
      expect(result.filename).toBe(data.storagePath.split('/')[1]);
    });

    it('mantém `url` na resposta (compat Mobile) apontando para a rota autenticada', async () => {
      const result = await service.save(
        COMPANY_ID,
        USER_ID,
        mockFile,
        'works',
        'w-00000001',
      );

      expect(result.url).toBe(
        uploadsAuthorizedUrl('works', result.filename),
      );
      expect(result.url).toMatch(/^\/api\/v1\/uploads\/works\//);
      createdFiles.push(join(UPLOADS_DIR, 'works', result.filename));
    });

    it('grava o arquivo em UPLOADS_DIR/<subdir>/', async () => {
      const result = await service.save(COMPANY_ID, USER_ID, mockFile, 'receipts', 'r-1');
      const fullPath = join(UPLOADS_DIR, 'receipts', result.filename);
      createdFiles.push(fullPath);
      expect(existsSync(fullPath)).toBe(true);
    });

    it('retorna attachmentId null quando o Prisma falha (modo legado, upload não quebra)', async () => {
      prisma.attachment.create.mockRejectedValueOnce(new Error('db down'));

      const result = await service.save(COMPANY_ID, USER_ID, mockFile, 'works', 'w-1');

      expect(result.attachmentId).toBeNull();
      expect(result.url).toMatch(/^\/api\/v1\/uploads\/works\//);
      createdFiles.push(join(UPLOADS_DIR, 'works', result.filename));
    });
  });

  describe('resolveAuthorized', () => {
    it('retorna caminho físico quando o Attachment pertence à empresa', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        id: 'att-1',
        companyId: COMPANY_ID,
        mimeType: 'image/jpeg',
        storagePath: 'works/arquivo.jpg',
        deletedAt: null,
      });

      const resolved = await service.resolveAuthorized(
        COMPANY_ID,
        'works',
        'arquivo.jpg',
      );

      expect(prisma.attachment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { storagePath: 'works/arquivo.jpg', deletedAt: null },
        }),
      );
      expect(resolved).not.toBeNull();
      expect(resolved!.fullPath).toBe(join(UPLOADS_DIR, 'works', 'arquivo.jpg'));
      expect(resolved!.mimeType).toBe('image/jpeg');
    });

    it('tenant isolation: retorno null (→404) quando o registro é de outra empresa', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        id: 'att-1',
        companyId: COMPANY_ID, // arquivo pertence à company-1
        mimeType: 'image/jpeg',
        storagePath: 'works/arquivo.jpg',
        deletedAt: null,
      });

      const resolved = await service.resolveAuthorized(
        OTHER_COMPANY_ID, // usuário da company-2 tenta baixar
        'works',
        'arquivo.jpg',
      );

      expect(resolved).toBeNull();
    });

    it('legado pré-migração (sem registro): retorno null (→404, fail-closed)', async () => {
      prisma.attachment.findFirst.mockResolvedValue(null);

      const resolved = await service.resolveAuthorized(
        COMPANY_ID,
        'works',
        'legado.jpg',
      );

      expect(resolved).toBeNull();
    });

    it('path traversal no filename: retorno null sem consultar o Prisma', async () => {
      const resolved = await service.resolveAuthorized(
        COMPANY_ID,
        'works',
        '..%2F..%2F.env',
      );

      expect(resolved).toBeNull();
      expect(prisma.attachment.findFirst).not.toHaveBeenCalled();
    });

    it('subdir inválido (traversal/sanitização diferente): retorno null', async () => {
      const resolved = await service.resolveAuthorized(
        COMPANY_ID,
        '../etc',
        'passwd.jpg',
      );

      expect(resolved).toBeNull();
      expect(prisma.attachment.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('helpers', () => {
    it('isValidFilename rejeita traversal, separadores e nomes estranhos', () => {
      expect(isValidFilename('arquivo.jpg')).toBe(true);
      expect(isValidFilename('a1b2c3d4-uuid.webp')).toBe(true);
      expect(isValidFilename('../../.env')).toBe(false);
      expect(isValidFilename('..')).toBe(false);
      expect(isValidFilename('a/b.jpg')).toBe(false);
      expect(isValidFilename('a\\b.jpg')).toBe(false);
      expect(isValidFilename('sem-extensão!')).toBe(false);
    });

    it('uploadsAuthorizedUrl usa o prefixo global configurado', () => {
      const previous = process.env.API_PREFIX;
      process.env.API_PREFIX = 'api/v9';
      expect(uploadsAuthorizedUrl('works', 'a.jpg')).toBe('/api/v9/uploads/works/a.jpg');
      if (previous === undefined) delete process.env.API_PREFIX;
      else process.env.API_PREFIX = previous;
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// UploadsController — contrato (companyId do request, nunca do body)
// ─────────────────────────────────────────────────────────────────────────

describe('UploadsController (V5 ETAPA 10)', () => {
  it('POST passa companyId/r.user.id do request para save()', async () => {
    const save = jest.fn().mockResolvedValue({ url: '/api/v1/uploads/works/a.jpg' });
    const controller = new UploadsController({ save } as any);

    await controller.upload(
      {
        company: { id: COMPANY_ID },
        user: { id: USER_ID },
        body: { entityType: 'works', entityId: 'w-1' },
      } as any,
      mockFile,
    );

    expect(save).toHaveBeenCalledWith(
      COMPANY_ID,
      USER_ID,
      mockFile,
      'works',
      'w-1',
    );
  });

  it('GET serve via res.sendFile com headers de segurança quando autorizado', async () => {
    const resolved = {
      fullPath: join(UPLOADS_DIR, 'works', 'a.jpg'),
      mimeType: 'image/jpeg',
    };
    const service = { resolveAuthorized: jest.fn().mockResolvedValue(resolved) };
    const controller = new UploadsController(service as any);
    const res = {
      setHeader: jest.fn(),
      sendFile: jest.fn((_: string, cb?: (err?: Error | null) => void) => cb?.(null)),
    } as unknown as Response;

    await controller.serve(
      { company: { id: COMPANY_ID } } as any,
      'works',
      'a.jpg',
      res,
    );

    expect(service.resolveAuthorized).toHaveBeenCalledWith(COMPANY_ID, 'works', 'a.jpg');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.sendFile).toHaveBeenCalledWith(resolved.fullPath, expect.any(Function));
  });

  it('GET lança NotFoundException quando não autorizado (outra empresa/legado)', async () => {
    const service = { resolveAuthorized: jest.fn().mockResolvedValue(null) };
    const controller = new UploadsController(service as any);
    const res = { setHeader: jest.fn(), sendFile: jest.fn() } as unknown as Response;

    await expect(
      controller.serve({ company: { id: OTHER_COMPANY_ID } } as any, 'works', 'a.jpg', res),
    ).rejects.toThrow(NotFoundException);
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('GET responde 404 quando sendFile falha (arquivo sumido do disco)', async () => {
    const service = {
      resolveAuthorized: jest.fn().mockResolvedValue({
        fullPath: join(UPLOADS_DIR, 'works', 'sumiu.jpg'),
        mimeType: 'image/jpeg',
      }),
    };
    const controller = new UploadsController(service as any);
    let statusFn: any;
    const res = {
      setHeader: jest.fn(),
      headersSent: false,
      status: jest.fn((s: number) => {
        statusFn = s;
        return res as any;
      }),
      json: jest.fn(),
      sendFile: jest.fn((_: string, cb: (err: Error | null) => void) =>
        cb(new Error('ENOENT')),
      ),
    } as unknown as Response;

    await controller.serve({ company: { id: COMPANY_ID } } as any, 'works', 'sumiu.jpg', res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404 }),
    );
    expect(statusFn).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Integração (guards reais sobrescritos) — 401 / 404 / 200
// ─────────────────────────────────────────────────────────────────────────

describe('Uploads e2e — leitura privada (V5 ETAPA 10)', () => {
  let app: INestApplication;
  let prisma: any;

  /**
   * JwtAuthGuard simulado: sem header → 401 (comportamento real do guard);
   * 'Bearer other-company' autentica na company-2; qualquer outro Bearer na company-1.
   */
  const fakeJwtGuard = {
    canActivate: (ctx: any) => {
      const req = ctx.switchToHttp().getRequest();
      const auth: string | undefined = req.headers?.authorization;
      if (!auth) {
        throw new UnauthorizedException('Token ausente');
      }
      const otherCompany = auth === 'Bearer other-company';
      req.user = { id: otherCompany ? 'user-2' : USER_ID };
      req.company = { id: otherCompany ? OTHER_COMPANY_ID : COMPANY_ID };
      return true;
    },
  };

  beforeAll(async () => {
    prisma = {
      attachment: {
        create: jest.fn().mockResolvedValue({ id: 'att-e2e-1' }),
        findFirst: jest.fn(),
      },
    };

    const mod = await Test.createTestingModule({
      imports: [UploadsModule, PrismaModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideGuard(JwtAuthGuard)
      .useValue(fakeJwtGuard)
      .overrideGuard(ActiveCompanyGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().member = { permissions: [] };
          return true;
        },
      })
      .overrideGuard(CompanyAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    // Mock de res.sendFile: o arquivo físico não existe — o spy intercepta e
    // responde 200, permitindo validar o fluxo autorizado ponta a ponta.
    (app as any).use((req: any, res: any, next: () => void) => {
      res.sendFile = (path: string, cb?: (err?: Error | null) => void) => {
        res.setHeader('Content-Type', 'image/jpeg');
        res.status(200).end('mock-bytes');
        cb?.(null);
      };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    cleanupCreatedFiles();
    await app.close();
  });

  it('POST /uploads cria Attachment com companyId da empresa autenticada', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer token-company-${COMPANY_ID}`)
      .field('entityType', 'works')
      .field('entityId', 'w-00000001')
      .attach('file', mockFile.buffer, { filename: 'foto.jpg', contentType: 'image/jpeg' })
      .expect(201);

    expect(res.body.attachmentId).toBe('att-e2e-1');
    expect(res.body.url).toMatch(/^\/api\/v1\/uploads\/works\//);
    expect(res.body.filename).toBeDefined();

    const data = (prisma.attachment.create.mock.calls[0] as any)[0].data;
    expect(data.companyId).toBe(COMPANY_ID);
    expect(data.createdById).toBe(USER_ID);
    expect(data.mimeType).toBe('image/jpeg');
    expect(data.storagePath).toBe(`works/${res.body.filename}`);

    createdFiles.push(join(UPLOADS_DIR, 'works', res.body.filename));
  });

  it('GET /uploads/:subdir/:filename sem token → 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/uploads/works/arquivo.jpg')
      .expect(401);
  });

  it('GET com token de outra empresa → 404 (não revela existência)', async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: 'att-1',
      companyId: COMPANY_ID,
      mimeType: 'image/jpeg',
      storagePath: 'works/arquivo.jpg',
      deletedAt: null,
    });

    await request(app.getHttpServer())
      .get('/api/v1/uploads/works/arquivo.jpg')
      .set('Authorization', 'Bearer other-company')
      .expect(404);
  });

  it('GET com token da empresa correta → 200 (res.sendFile mockado)', async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: 'att-1',
      companyId: COMPANY_ID,
      mimeType: 'image/jpeg',
      storagePath: 'works/arquivo.jpg',
      deletedAt: null,
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/uploads/works/arquivo.jpg')
      .set('Authorization', `Bearer token-company-${COMPANY_ID}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('image/jpeg');
    expect(prisma.attachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storagePath: 'works/arquivo.jpg', deletedAt: null },
      }),
    );
  });

  it('GET de legado (sem registro Attachment) → 404 fail-closed mesmo da empresa certa', async () => {
    prisma.attachment.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/api/v1/uploads/works/legado.jpg')
      .set('Authorization', `Bearer token-company-${COMPANY_ID}`)
      .expect(404);
  });

  it('GET com path traversal no filename → 404', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/uploads/works/..%2F..%2Fpackage.json')
      .set('Authorization', `Bearer token-company-${COMPANY_ID}`)
      .expect(404);
  });
});
