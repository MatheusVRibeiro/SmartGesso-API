import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttachmentsService } from '../src/modules/attachments/attachments.service';
import { LocalStorageProvider } from '../src/modules/attachments/storage-provider';

/**
 * Testes unitários do AttachmentsService — ETAPA 8 V4.
 *
 * PrismaService é mockado — nenhum banco é acessado.
 * StorageProvider é mockado — nenhum disco é acessado no serviço.
 * O disco é usado de forma controlada (arquivo real criado e removido no afterEach) APENAS para testes de integração/validação.
 *
 * Cobre: CRUD, soft delete, tenant isolation (A não baixa de B) e validações de MIME.
 */
describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let prisma: any;
  let storageProvider: any;

  const COMPANY_ID = 'company-1';
  const OTHER_COMPANY_ID = 'company-2';
  const USER_ID = 'user-1';
  const ATTACHMENT_ID = 'att-1';
  const ENTITY_TYPE = 'service-order';
  const ENTITY_ID = 'so-00000001';

  const mockFile: Express.Multer.File = {
    originalname: 'foto.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('conteudo-do-arquivo'),
    encoding: '7bit',
    fieldname: 'file',
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };

  beforeEach(() => {
    prisma = {
      attachment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    storageProvider = {
      save: jest.fn().mockResolvedValue('mock-storage-path'),
      get: jest.fn(),
      exists: jest.fn().mockResolvedValue(true),
      delete: jest.fn(),
    };
    service = new AttachmentsService(prisma, storageProvider);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Helpers ──────────────────────────────────────────────

  function mockAttachment(overrides: Record<string, any> = {}) {
    return {
      id: ATTACHMENT_ID,
      companyId: COMPANY_ID,
      entityType: ENTITY_TYPE,
      entityId: ENTITY_ID,
      originalName: 'foto.jpg',
      storagePath: join(
        process.cwd(),
        'attachments-storage',
        COMPANY_ID,
        `${ATTACHMENT_ID}.jpg`,
      ),
      mimeType: 'image/jpeg',
      size: 1024,
      createdById: USER_ID,
      createdAt: new Date(),
      deletedAt: null,
      ...overrides,
    };
  }

  // ── create ─────────────────────────────────────────────

  describe('create', () => {
    it('salva arquivo via StorageProvider e cria registro Prisma', async () => {
      const created = mockAttachment();
      prisma.attachment.create.mockResolvedValue(created);

      const result = await service.create(
        COMPANY_ID,
        USER_ID,
        mockFile,
        ENTITY_TYPE,
        ENTITY_ID,
      );

      // Verifica que o create recebeu os campos corretos scoped pela empresa
      expect(prisma.attachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            entityType: ENTITY_TYPE,
            entityId: ENTITY_ID,
            originalName: 'foto.jpg',
            mimeType: 'image/jpeg',
            size: 1024,
            createdById: USER_ID,
          }),
        }),
      );

      // Verifica que o storagePath foi passado para o create
      const callData = (prisma.attachment.create.mock.calls[0] as any)[0].data;
      expect(callData.storagePath).toBe('mock-storage-path');

      // Verifica que o StorageProvider.save foi chamado corretamente
      expect(storageProvider.save).toHaveBeenCalledWith(
        mockFile.buffer,
        expect.stringContaining(COMPANY_ID),
      );

      expect(result).toEqual(created);
    });

    it('lança BadRequestException quando o arquivo não é enviado', async () => {
      await expect(
        service.create(COMPANY_ID, USER_ID, null as any, ENTITY_TYPE, ENTITY_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException para MIME não permitido (ex: text/plain)', async () => {
      const badFile = { ...mockFile, mimetype: 'text/plain' };

      await expect(
        service.create(COMPANY_ID, USER_ID, badFile, ENTITY_TYPE, ENTITY_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('aceita application/pdf', async () => {
      const pdfFile = {
        ...mockFile,
        originalname: 'doc.pdf',
        mimetype: 'application/pdf',
      };
      prisma.attachment.create.mockResolvedValue(mockAttachment());

      await service.create(COMPANY_ID, USER_ID, pdfFile, ENTITY_TYPE, ENTITY_ID);

      expect(prisma.attachment.create).toHaveBeenCalled();
      expect(storageProvider.save).toHaveBeenCalled();
    });

    it('aceita image/heic', async () => {
      const heicFile = {
        ...mockFile,
        originalname: 'foto.heic',
        mimetype: 'image/heic',
      };
      prisma.attachment.create.mockResolvedValue(mockAttachment());

      await service.create(COMPANY_ID, USER_ID, heicFile, ENTITY_TYPE, ENTITY_ID);

      expect(prisma.attachment.create).toHaveBeenCalled();
      expect(storageProvider.save).toHaveBeenCalled();
    });

    it('lança BadRequestException quando entityType ou entityId faltam', async () => {
      await expect(
        service.create(COMPANY_ID, USER_ID, mockFile, '', ENTITY_ID),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create(COMPANY_ID, USER_ID, mockFile, ENTITY_TYPE, ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException para entityId com path traversal (../)', async () => {
      await expect(
        service.create(
          COMPANY_ID,
          USER_ID,
          mockFile,
          ENTITY_TYPE,
          '../../../../etc/cron.d/evil',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(storageProvider.save).not.toHaveBeenCalled();
      expect(prisma.attachment.create).not.toHaveBeenCalled();
    });

    it('lança BadRequestException para entityId curto demais (< 8 chars)', async () => {
      await expect(
        service.create(COMPANY_ID, USER_ID, mockFile, ENTITY_TYPE, 'so-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException para entityId com caracteres fora de [A-Za-z0-9-]', async () => {
      await expect(
        service.create(COMPANY_ID, USER_ID, mockFile, ENTITY_TYPE, 'so/1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── listByEntity ────────────────────────────────────────

  describe('listByEntity', () => {
    it('retorna apenas não-deletados da empresa e entidade informada', async () => {
      const attachments = [
        mockAttachment({ id: 'att-1' }),
        mockAttachment({ id: 'att-2' }),
      ];
      prisma.attachment.findMany.mockResolvedValue(attachments);

      const result = await service.listByEntity(
        COMPANY_ID,
        ENTITY_TYPE,
        ENTITY_ID,
      );

      expect(prisma.attachment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: COMPANY_ID,
            entityType: ENTITY_TYPE,
            entityId: ENTITY_ID,
            deletedAt: null,
          }),
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('não retorna attachments deletados (soft delete filtra)', async () => {
      prisma.attachment.findMany.mockResolvedValue([]);

      await service.listByEntity(COMPANY_ID, ENTITY_TYPE, ENTITY_ID);

      expect(prisma.attachment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });
  });

  // ── remove (soft delete) ─────────────────────────────────

  describe('remove', () => {
    it('marca deletedAt sem remover o registro (soft delete)', async () => {
      prisma.attachment.findFirst.mockResolvedValue(mockAttachment());
      prisma.attachment.update.mockResolvedValue(
        mockAttachment({ deletedAt: new Date() }),
      );

      const result = await service.remove(COMPANY_ID, ATTACHMENT_ID);

      expect(prisma.attachment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ATTACHMENT_ID, companyId: COMPANY_ID, deletedAt: null },
        }),
      );
      expect(prisma.attachment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ATTACHMENT_ID },
          data: { deletedAt: expect.any(Date) },
        }),
      );
      expect(result.deletedAt).not.toBeNull();
    });

    it('lança NotFoundException quando o attachment não existe', async () => {
      prisma.attachment.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(COMPANY_ID, 'inexistente'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getStoragePath (download privado) ───────────────────

  describe('getStoragePath', () => {
    it('retorna caminho absoluto quando o registro pertence à empresa', async () => {
      const attachment = mockAttachment();
      prisma.attachment.findFirst.mockResolvedValue(attachment);
      storageProvider.exists.mockResolvedValue(true);

      const path = await service.getStoragePath(COMPANY_ID, ATTACHMENT_ID);

      expect(path).toBe(attachment.storagePath);
      expect(storageProvider.exists).toHaveBeenCalledWith(attachment.storagePath);
    });

    it('tenant isolation: empresa A não consegue resolver caminho de empresa B', async () => {
      // O registro pertence à empresa B, mas a empresa A tenta acessar
      prisma.attachment.findFirst.mockResolvedValue(null);

      await expect(
        service.getStoragePath(OTHER_COMPANY_ID, ATTACHMENT_ID),
      ).rejects.toThrow(NotFoundException);

      // Garante que a query foi scoped pela empresa B (não retorna dados de A)
      expect(prisma.attachment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: ATTACHMENT_ID,
            companyId: OTHER_COMPANY_ID,
            deletedAt: null,
          },
        }),
      );
    });

    it('lança NotFoundException quando o attachment foi soft-deletado', async () => {
      prisma.attachment.findFirst.mockResolvedValue(null);

      await expect(
        service.getStoragePath(COMPANY_ID, ATTACHMENT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException quando o arquivo físico não existe no disco', async () => {
      const attachment = mockAttachment({
        storagePath: join(
          process.cwd(),
          'attachments-storage',
          COMPANY_ID,
          'arquivo-inexistente.jpg',
        ),
      });
      prisma.attachment.findFirst.mockResolvedValue(attachment);
      storageProvider.exists.mockResolvedValue(false);

      await expect(
        service.getStoragePath(COMPANY_ID, ATTACHMENT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── tenant isolation (CRUD cruzado) ─────────────────────

  describe('tenant isolation', () => {
    it('listByEntity de empresa A não retorna attachments de empresa B', async () => {
      prisma.attachment.findMany.mockResolvedValue([]);

      await service.listByEntity(OTHER_COMPANY_ID, ENTITY_TYPE, ENTITY_ID);

      expect(prisma.attachment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: OTHER_COMPANY_ID,
          }),
        }),
      );
    });

    it('remove de empresa A não encontra attachment de empresa B', async () => {
      prisma.attachment.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(OTHER_COMPANY_ID, ATTACHMENT_ID),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.attachment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: ATTACHMENT_ID,
            companyId: OTHER_COMPANY_ID,
            deletedAt: null,
          },
        }),
      );
    });

    it('create sempre usa o companyId do contexto, nunca do body', async () => {
      prisma.attachment.create.mockResolvedValue(mockAttachment());

      await service.create(
        COMPANY_ID,
        USER_ID,
        mockFile,
        ENTITY_TYPE,
        ENTITY_ID,
      );

      const callData = (prisma.attachment.create.mock.calls[0] as any)[0].data;
      expect(callData.companyId).toBe(COMPANY_ID);
    });
  });
});

describe('LocalStorageProvider.save (path traversal)', () => {
  let provider: LocalStorageProvider;

  const LOCAL_COMPANY_ID = 'company-local';
  const LOCAL_ENTITY_ID = 'so-local-0001';

  beforeEach(() => {
    provider = new LocalStorageProvider();
  });

  it('rejeita relativePath com ../ que escapa do baseDir', async () => {
    await expect(
      provider.save(Buffer.from('x'), '../../../../tmp/evil.txt'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita relativePath absoluto fora do baseDir', async () => {
    await expect(
      provider.save(Buffer.from('x'), join(process.cwd(), 'uploads', 'evil.txt')),
    ).rejects.toThrow(BadRequestException);
  });

  it('salva arquivo legítimo dentro do baseDir', async () => {
    const relativePath = join(LOCAL_COMPANY_ID, 'geral', LOCAL_ENTITY_ID, 'a1.jpg');
    const fullPath = await provider.save(Buffer.from('conteudo'), relativePath);

    expect(fullPath.startsWith(join(process.cwd(), 'attachments-storage'))).toBe(
      true,
    );
    expect(existsSync(fullPath)).toBe(true);

    // Limpeza
    await provider.delete(fullPath);
    expect(existsSync(fullPath)).toBe(false);
  });
});
