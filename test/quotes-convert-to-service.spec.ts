import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { QuotesService } from '../src/modules/quotes/quotes.service';

/**
 * Testes unitários da conversão Orçamento → Serviço (convertToService).
 * PrismaService é mockado — nenhum banco é acessado.
 */
describe('QuotesService.convertToService', () => {
  let service: QuotesService;
  let prisma: any;
  let tx: any;

  const quoteBase = {
    id: 'quote-1',
    companyId: 'company-1',
    clientId: 'client-1',
    workId: 'work-1',
    quoteNumber: 42,
    version: 1,
    status: 'APROVADO',
    subtotal: 1000,
    discount: 50,
    marginPct: 10,
    total: 1050,
    paymentMethod: 'AVISTA',
    observations: 'Observações do orçamento',
    startDate: new Date('2026-09-01T10:00:00.000Z'),
    convertedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    client: { id: 'client-1', name: 'Cliente Teste' },
    work: { id: 'work-1', name: 'Obra Teste' },
    items: [],
  };

  const createdOrder = {
    id: 'os-1',
    companyId: 'company-1',
    clientId: 'client-1',
    workId: 'work-1',
    code: 7,
    status: 'PENDENTE',
    scheduledDate: new Date('2026-09-01T10:00:00.000Z'),
    saleValue: 1050,
    observations: 'Observações do orçamento',
    client: { id: 'client-1', name: 'Cliente Teste' },
    work: { id: 'work-1', name: 'Obra Teste' },
    materials: [],
  };

  function buildPrismaMock(overrides: Partial<any> = {}) {
    tx = {
      serviceOrder: {
        findFirst: jest.fn().mockResolvedValue({ code: 6 }),
        create: jest.fn().mockResolvedValue(createdOrder),
      },
      quote: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      ...(overrides.tx ?? {}),
    };

    prisma = {
      quote: {
        findFirst: jest.fn().mockResolvedValue(quoteBase),
      },
      $transaction: jest.fn(async (fn: (t: any) => any) => fn(tx)),
      ...(overrides.prisma ?? {}),
    };

    return { prismaMock: prisma, tx };
  }

  beforeEach(() => {
    buildPrismaMock();
    service = new QuotesService(prisma);
  });

  it('cria OS reaproveitando cliente, obra, observações, startDate e total', async () => {
    const result = await service.convertToService('company-1', 'quote-1');

    // Dados enviados ao create da OS
    const createData = tx.serviceOrder.create.mock.calls[0][0].data;
    expect(createData).toEqual(
      expect.objectContaining({
        companyId: 'company-1',
        clientId: 'client-1',
        workId: 'work-1',
        status: 'PENDENTE',
        scheduledDate: new Date('2026-09-01T10:00:00.000Z'),
        saleValue: 1050,
        observations: 'Observações do orçamento',
      }),
    );

    // Resposta contém serviceOrderId + dados da OS criada
    expect(result.serviceOrderId).toBe('os-1');
    expect(result.code).toBe(7);
    expect(result.status).toBe('PENDENTE');
    expect(result.clientId).toBe('client-1');
    expect(result.workId).toBe('work-1');
    expect(result.saleValue).toBe(1050);
  });

  it('gera código sequencial da OS dentro da transação', async () => {
    await service.convertToService('company-1', 'quote-1');

    expect(tx.serviceOrder.findFirst).toHaveBeenCalledWith({
      where: { companyId: 'company-1' },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    expect(tx.serviceOrder.create.mock.calls[0][0].data.code).toBe(7);
  });

  it('marca o orçamento como convertido (convertedAt) dentro da transação', async () => {
    await service.convertToService('company-1', 'quote-1');

    expect(tx.quote.updateMany).toHaveBeenCalledWith({
      where: { id: 'quote-1', convertedAt: null },
      data: { convertedAt: expect.any(Date) },
    });
  });

  it('lança 409 Conflict quando o orçamento já foi convertido', async () => {
    buildPrismaMock({
      prisma: {
        quote: {
          findFirst: jest.fn().mockResolvedValue({
            ...quoteBase,
            convertedAt: new Date('2026-08-19T00:00:00.000Z'),
          }),
        },
      },
    });
    service = new QuotesService(prisma);

    await expect(service.convertToService('company-1', 'quote-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('lança 400 BadRequest quando o orçamento não está APROVADO', async () => {
    buildPrismaMock({
      prisma: {
        quote: {
          findFirst: jest.fn().mockResolvedValue({
            ...quoteBase,
            status: 'RASCUNHO',
          }),
        },
      },
    });
    service = new QuotesService(prisma);

    await expect(service.convertToService('company-1', 'quote-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('lança 404 NotFound quando o orçamento não existe', async () => {
    buildPrismaMock({
      prisma: {
        quote: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      },
    });
    service = new QuotesService(prisma);

    await expect(service.convertToService('company-1', 'inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('empresa vem do contexto autenticado (nunca do body)', async () => {
    await service.convertToService('company-autenticada', 'quote-1');

    expect(prisma.quote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-autenticada' }),
      }),
    );
    expect(tx.serviceOrder.create.mock.calls[0][0].data.companyId).toBe(
      'company-autenticada',
    );
  });
});