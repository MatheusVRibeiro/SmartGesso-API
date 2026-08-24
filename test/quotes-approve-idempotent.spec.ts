import { BadRequestException } from '@nestjs/common';
import { QuotesService } from '../src/modules/quotes/quotes.service';

/**
 * Testes unitários da aprovação idempotente (approve).
 * PrismaService é mockado — nenhum banco é acessado.
 */
describe('QuotesService.approve (idempotente)', () => {
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
    status: 'AGUARDANDO_APROVACAO',
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
    quoteId: 'quote-1',
    code: 7,
    status: 'PENDENTE',
    scheduledDate: new Date('2026-09-01T10:00:00.000Z'),
    saleValue: 1050,
    observations: 'Observações do orçamento',
    client: { id: 'client-1', name: 'Cliente Teste' },
    work: { id: 'work-1', name: 'Obra Teste' },
    quote: { id: 'quote-1', quoteNumber: 42, version: 1 },
    materials: [],
  };

  function buildPrismaMock(overrides: Partial<any> = {}) {
    tx = {
      serviceOrder: {
        findFirst: jest.fn().mockResolvedValue(null), // Nenhuma OS existente
        create: jest.fn().mockResolvedValue(createdOrder),
      },
      quote: {
        update: jest.fn().mockImplementation(({ where: _where, data }) => {
          if (data.status) {
            // Update de status
            return Promise.resolve({ ...quoteBase, ...data });
          }
          // Update de convertedAt
          return Promise.resolve({ ...quoteBase, convertedAt: new Date() });
        }),
        create: jest.fn(), // Não usado no approve
      },
      quoteHistory: {
        create: jest.fn(),
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

  it('cria OS na primeira aprovação e retorna serviceOrderCreated=true', async () => {
    const result = await service.approve('company-1', 'quote-1');

    expect(result.quote.status).toBe('APROVADO');
    expect(result.serviceOrder).toBeDefined();
    expect(result.serviceOrder.code).toBe(7);
    expect(result.serviceOrder.status).toBe('PENDENTE');
    expect(result.serviceOrderCreated).toBe(true);

    // Verificar que a OS foi criada com os dados corretos
    const createData = tx.serviceOrder.create.mock.calls[0][0].data;
    expect(createData).toEqual(
      expect.objectContaining({
        companyId: 'company-1',
        clientId: 'client-1',
        workId: 'work-1',
        quoteId: 'quote-1',
        status: 'PENDENTE',
        scheduledDate: new Date('2026-09-01T10:00:00.000Z'),
        saleValue: 1050,
        observations: 'Observações do orçamento',
      }),
    );

    // Verificar que convertedAt foi atualizado
    expect(tx.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'quote-1' },
        data: { convertedAt: expect.any(Date) },
      }),
    );
  });

  it('retorna OS existente na segunda aprovação (idempotente)', async () => {
    // Simular que já existe uma OS para este orçamento
    const existingOrder = { ...createdOrder, code: 5 };
    buildPrismaMock({
      tx: {
        serviceOrder: {
          findFirst: jest.fn().mockResolvedValue(existingOrder),
          create: jest.fn(),
        },
      },
    });
    service = new QuotesService(prisma);

    // Simular que o orçamento já está APROVADO
    prisma.quote.findFirst.mockResolvedValue({
      ...quoteBase,
      status: 'APROVADO',
    });

    const result = await service.approve('company-1', 'quote-1');

    // Não deve criar nova OS
    expect(tx.serviceOrder.create).not.toHaveBeenCalled();

    // Deve retornar a OS existente
    expect(result.serviceOrder.code).toBe(5);
    expect(result.serviceOrderCreated).toBe(false);

    // Não deve duplicar histórico (já está APROVADO)
    expect(tx.quoteHistory.create).not.toHaveBeenCalled();
  });

  it('lança 400 BadRequest quando orçamento está cancelado', async () => {
    prisma.quote.findFirst.mockResolvedValue({
      ...quoteBase,
      status: 'CANCELADO',
    });
    service = new QuotesService(prisma);

    await expect(service.approve('company-1', 'quote-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('empresa vem do contexto autenticado (nunca do body)', async () => {
    await service.approve('company-autenticada', 'quote-1');

    expect(prisma.quote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-autenticada' }),
      }),
    );
    expect(tx.serviceOrder.create.mock.calls[0][0].data.companyId).toBe(
      'company-autenticada',
    );
  });

  it('mantém dados do orçamento na OS (clientId, workId, startDate, total, observations)', async () => {
    await service.approve('company-1', 'quote-1');

    const createData = tx.serviceOrder.create.mock.calls[0][0].data;
    expect(createData.clientId).toBe('client-1');
    expect(createData.workId).toBe('work-1');
    expect(createData.scheduledDate).toEqual(
      new Date('2026-09-01T10:00:00.000Z'),
    );
    expect(createData.saleValue).toBe(1050);
    expect(createData.observations).toBe('Observações do orçamento');
  });

  it('cria histórico na primeira aprovação', async () => {
    await service.approve('company-1', 'quote-1');

    expect(tx.quoteHistory.create).toHaveBeenCalledWith({
      data: {
        quoteId: 'quote-1',
        status: 'APROVADO',
        note: 'Orçamento aprovado',
      },
    });
  });
});
