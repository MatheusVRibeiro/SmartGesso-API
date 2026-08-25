import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuotesService } from '../src/modules/quotes/quotes.service';

/**
 * Testes unitários do versionamento de orçamento (ETAPA 3 V4).
 * PrismaService é mockado — nenhum banco é acessado.
 *
 * Regras validadas:
 * - nova versão mantém quoteNumber;
 * - nova versão incrementa version;
 * - duplicar gera novo quoteNumber e version 1;
 * - original não pode ser alterado após criar nova versão;
 * - preserve tenant isolation;
 * - trate concorrência de versão.
 */
describe('QuotesService.versioning (ETAPA 3 V4)', () => {
  let service: QuotesService;
  let prisma: any;
  let sequenceService: any;

  const quoteV1 = {
    id: 'quote-v1',
    companyId: 'company-1',
    clientId: 'client-1',
    workId: 'work-1',
    quoteNumber: 52,
    version: 1,
    status: 'RASCUNHO',
    subtotal: 1000,
    discount: 50,
    marginPct: 10,
    total: 1050,
    paymentMethod: 'AVISTA',
    paymentTerms: 'AVISTA',
    localAddress: { cep: '12345-678', cidade: 'São Paulo' },
    startDate: new Date('2026-09-01T10:00:00.000Z'),
    durationDays: 30,
    endDate: new Date('2026-10-01T10:00:00.000Z'),
    deadlineDate: new Date('2026-09-15T10:00:00.000Z'),
    visitDate: new Date('2026-08-25T10:00:00.000Z'),
    measurementDate: new Date('2026-08-20T10:00:00.000Z'),
    warrantyDays: 90,
    validUntil: new Date('2026-10-01T10:00:00.000Z'),
    observations: 'Observações do orçamento',
    convertedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    client: { id: 'client-1', name: 'Cliente Teste' },
    work: { id: 'work-1', name: 'Obra Teste' },
    items: [
      {
        id: 'item-1',
        quoteId: 'quote-v1',
        itemType: 'PRODUTO',
        name: 'Produto Teste',
        description: 'Descrição',
        quantity: 10,
        unit: 'un',
        unitPrice: 100,
        total: 1000,
        createdAt: new Date(),
      },
    ],
  };

  const quoteV2 = {
    ...quoteV1,
    id: 'quote-v2',
    version: 2,
    status: 'RASCUNHO',
  };

  /**
   * Configura o mock de findFirst para createVersion:
   * 1. findOne → quote
   * 2. latestVersion check → { version: quote.version, id: quote.id } (mesma versão)
   * 3. existingVersion check → null (versão alvo não existe)
   */
  function mockCreateVersionSuccess(quote: any) {
    prisma.quote.findFirst = jest
      .fn()
      .mockResolvedValueOnce(quote) // findOne
      .mockResolvedValueOnce({ version: quote.version, id: quote.id }) // latestVersion check (same)
      .mockResolvedValueOnce(null); // existingVersion check (target doesn't exist)
  }

  beforeEach(() => {
    prisma = {
      quote: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      quoteItem: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (t: any) => any) => fn(prisma)),
    };
    sequenceService = { increment: jest.fn().mockResolvedValue(53) };
    service = new QuotesService(
      prisma,
      sequenceService,
      { log: jest.fn() } as any,
      { create: jest.fn() } as any,
      { sendToCompany: jest.fn() } as any,
    );
  });

  describe('createVersion', () => {
    it('mantém quoteNumber e incrementa version (v1 → v2)', async () => {
      mockCreateVersionSuccess(quoteV1);
      prisma.quote.create = jest.fn().mockResolvedValue(quoteV2);

      const result = await service.createVersion('company-1', 'quote-v1');

      expect(result.quoteNumber).toBe(52);
      expect(result.version).toBe(2);
      expect(result.id).toBe('quote-v2');
    });

    it('copia todos os campos comerciais do original', async () => {
      mockCreateVersionSuccess(quoteV1);
      prisma.quote.create = jest.fn().mockResolvedValue(quoteV2);

      const result = await service.createVersion('company-1', 'quote-v1');

      expect(result.clientId).toBe(quoteV1.clientId);
      expect(result.workId).toBe(quoteV1.workId);
      expect(result.subtotal).toBe(quoteV1.subtotal);
      expect(result.discount).toBe(quoteV1.discount);
      expect(result.marginPct).toBe(quoteV1.marginPct);
      expect(result.total).toBe(quoteV1.total);
      expect(result.paymentMethod).toBe(quoteV1.paymentMethod);
      expect(result.paymentTerms).toBe(quoteV1.paymentTerms);
      expect(result.localAddress).toEqual(quoteV1.localAddress);
      expect(result.startDate).toEqual(quoteV1.startDate);
      expect(result.durationDays).toBe(quoteV1.durationDays);
      expect(result.endDate).toEqual(quoteV1.endDate);
      expect(result.deadlineDate).toEqual(quoteV1.deadlineDate);
      expect(result.visitDate).toEqual(quoteV1.visitDate);
      expect(result.measurementDate).toEqual(quoteV1.measurementDate);
      expect(result.warrantyDays).toBe(quoteV1.warrantyDays);
      expect(result.validUntil).toEqual(quoteV1.validUntil);
      expect(result.observations).toBe(quoteV1.observations);
    });

    it('copia todos os itens do orçamento original', async () => {
      mockCreateVersionSuccess(quoteV1);
      prisma.quote.create = jest.fn().mockResolvedValue(quoteV2);

      const result = await service.createVersion('company-1', 'quote-v1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Produto Teste');
      expect(result.items[0].quantity).toBe(10);
      expect(result.items[0].unitPrice).toBe(100);
      expect(result.items[0].total).toBe(1000);
    });

    it('nova versão começa com status RASCUNHO', async () => {
      mockCreateVersionSuccess(quoteV1);
      prisma.quote.create = jest.fn().mockResolvedValue(quoteV2);

      const result = await service.createVersion('company-1', 'quote-v1');

      expect(result.status).toBe('RASCUNHO');
    });

    it('cria histórico com note descrevendo a nova versão', async () => {
      mockCreateVersionSuccess(quoteV1);
      prisma.quote.create = jest.fn().mockResolvedValue(quoteV2);

      await service.createVersion('company-1', 'quote-v1');

      const createData = prisma.quote.create.mock.calls[0][0].data;
      expect(createData.history.create).toEqual({
        status: 'RASCUNHO',
        note: 'Nova versão (v2) do orçamento #52',
      });
    });

    it('usa quoteNumber do original, não gera novo número', async () => {
      mockCreateVersionSuccess(quoteV1);
      prisma.quote.create = jest.fn().mockResolvedValue(quoteV2);

      await service.createVersion('company-1', 'quote-v1');

      const createData = prisma.quote.create.mock.calls[0][0].data;
      expect(createData.quoteNumber).toBe(52);
      expect(createData.version).toBe(2);
    });

    it('lança BadRequestException se já existe versão mais recente', async () => {
      prisma.quote.findFirst = jest
        .fn()
        .mockResolvedValueOnce(quoteV1) // findOne
        .mockResolvedValueOnce({ version: 2, id: 'quote-v2' }); // latestVersion check (newer exists)

      await expect(service.createVersion('company-1', 'quote-v1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lança BadRequestException se versão alvo já foi criada (concorrência)', async () => {
      prisma.quote.findFirst = jest
        .fn()
        .mockResolvedValueOnce(quoteV1) // findOne
        .mockResolvedValueOnce({ version: 1, id: 'quote-v1' }) // latestVersion check (same)
        .mockResolvedValueOnce({ id: 'quote-v2' }); // existingVersion check (v2 already exists)

      await expect(service.createVersion('company-1', 'quote-v1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('preserve tenant isolation — não encontra quote de outra empresa', async () => {
      prisma.quote.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.createVersion('company-2', 'quote-v1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('cria v3 a partir de v2 mantendo quoteNumber', async () => {
      const quoteV2Full = { ...quoteV1, id: 'quote-v2', version: 2 };
      const quoteV3 = { ...quoteV1, id: 'quote-v3', version: 3 };

      prisma.quote.findFirst = jest
        .fn()
        .mockResolvedValueOnce(quoteV2Full) // findOne
        .mockResolvedValueOnce({ version: 2, id: 'quote-v2' }) // latestVersion check (same)
        .mockResolvedValueOnce(null); // existingVersion check (v3 doesn't exist)

      prisma.quote.create = jest.fn().mockResolvedValue(quoteV3);

      const result = await service.createVersion('company-1', 'quote-v2');

      expect(result.quoteNumber).toBe(52);
      expect(result.version).toBe(3);
    });
  });

  describe('duplicate', () => {
    it('gera novo quoteNumber e version 1', async () => {
      prisma.quote.findFirst = jest
        .fn()
        .mockResolvedValueOnce(quoteV1) // findOne

      const duplicated = {
        ...quoteV1,
        id: 'quote-dup',
        quoteNumber: 53,
        version: 1,
        status: 'RASCUNHO',
      };
      prisma.quote.create = jest.fn().mockResolvedValue(duplicated);

      const result = await service.duplicate('company-1', 'quote-v1');

      expect(result.quoteNumber).toBe(53);
      expect(result.version).toBe(1);
      expect(result.status).toBe('RASCUNHO');
    });

    it('duplicar #52 v2 gera novo número v1', async () => {
      const quoteV2Full = { ...quoteV1, id: 'quote-v2', version: 2 };

      prisma.quote.findFirst = jest
        .fn()
        .mockResolvedValueOnce(quoteV2Full) // findOne

      const duplicated = {
        ...quoteV2Full,
        id: 'quote-dup',
        quoteNumber: 53,
        version: 1,
        status: 'RASCUNHO',
      };
      prisma.quote.create = jest.fn().mockResolvedValue(duplicated);

      const result = await service.duplicate('company-1', 'quote-v2');

      expect(result.quoteNumber).toBe(53);
      expect(result.version).toBe(1);
    });

    it('copia todos os campos comerciais na duplicação', async () => {
      prisma.quote.findFirst = jest
        .fn()
        .mockResolvedValueOnce(quoteV1) // findOne

      const duplicated = {
        ...quoteV1,
        id: 'quote-dup',
        quoteNumber: 53,
        version: 1,
        status: 'RASCUNHO',
      };
      prisma.quote.create = jest.fn().mockResolvedValue(duplicated);

      const result = await service.duplicate('company-1', 'quote-v1');

      expect(result.clientId).toBe(quoteV1.clientId);
      expect(result.workId).toBe(quoteV1.workId);
      expect(result.subtotal).toBe(quoteV1.subtotal);
      expect(result.total).toBe(quoteV1.total);
      expect(result.paymentMethod).toBe(quoteV1.paymentMethod);
      expect(result.paymentTerms).toBe(quoteV1.paymentTerms);
      expect(result.localAddress).toEqual(quoteV1.localAddress);
      expect(result.observations).toBe(quoteV1.observations);
    });

    it('cria histórico na duplicação', async () => {
      prisma.quote.findFirst = jest
        .fn()
        .mockResolvedValueOnce(quoteV1) // findOne

      const duplicated = {
        ...quoteV1,
        id: 'quote-dup',
        quoteNumber: 53,
        version: 1,
        status: 'RASCUNHO',
      };
      prisma.quote.create = jest.fn().mockResolvedValue(duplicated);

      await service.duplicate('company-1', 'quote-v1');

      const createData = prisma.quote.create.mock.calls[0][0].data;
      expect(createData.history.create).toEqual({
        status: 'RASCUNHO',
        note: 'Duplicado do orçamento #52',
      });
    });
  });

  describe('update (proteção de original)', () => {
    it('lança BadRequestException ao tentar atualizar original após nova versão', async () => {
      prisma.quote.findFirst = jest
        .fn()
        .mockResolvedValueOnce(quoteV1) // findOne
        .mockResolvedValueOnce({ version: 2, id: 'quote-v2' }); // latestVersion check

      await expect(
        service.update('company-1', 'quote-v1', { observations: 'nova' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('permite atualização quando não existe versão mais recente', async () => {
      prisma.quote.findFirst = jest
        .fn()
        .mockResolvedValueOnce(quoteV1) // findOne
        .mockResolvedValueOnce({ version: 1, id: 'quote-v1' }); // latestVersion check

      prisma.$transaction = jest.fn(async (fn: (t: any) => any) => fn(prisma));
      prisma.quote.update = jest.fn().mockResolvedValue({
        ...quoteV1,
        observations: 'nova',
      });

      const result = await service.update('company-1', 'quote-v1', {
        observations: 'nova',
      });

      expect(result.observations).toBe('nova');
    });

    it('permite atualização na versão mais recente (v2)', async () => {
      prisma.quote.findFirst = jest
        .fn()
        .mockResolvedValueOnce(quoteV2) // findOne
        .mockResolvedValueOnce({ version: 2, id: 'quote-v2' }); // latestVersion check

      prisma.$transaction = jest.fn(async (fn: (t: any) => any) => fn(prisma));
      prisma.quote.update = jest.fn().mockResolvedValue({
        ...quoteV2,
        observations: 'nova',
      });

      const result = await service.update('company-1', 'quote-v2', {
        observations: 'nova',
      });

      expect(result.observations).toBe('nova');
    });
  });

  describe('remove (proteção de original)', () => {
    it('lança BadRequestException ao tentar excluir original após nova versão', async () => {
      prisma.quote.findFirst = jest
        .fn()
        .mockResolvedValueOnce(quoteV1) // findOne
        .mockResolvedValueOnce({ version: 2, id: 'quote-v2' }); // latestVersion check

      await expect(service.remove('company-1', 'quote-v1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('permite exclusão quando não existe versão mais recente', async () => {
      prisma.quote.findFirst = jest
        .fn()
        .mockResolvedValueOnce(quoteV1) // findOne
        .mockResolvedValueOnce({ version: 1, id: 'quote-v1' }); // latestVersion check

      prisma.quote.update = jest.fn().mockResolvedValue({
        ...quoteV1,
        deletedAt: new Date(),
      });

      const result = await service.remove('company-1', 'quote-v1');

      expect(result.deletedAt).toBeDefined();
    });
  });
});
