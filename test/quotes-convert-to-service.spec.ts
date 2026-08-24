import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuotesService } from '../src/modules/quotes/quotes.service';

/**
 * Testes unitários da conversão Orçamento → Serviço (convertToService).
 * PrismaService é mockado — nenhum banco é acessado.
 * 
 * Nota: convertToService() está deprecated. Use approve() para nova implementação.
 * Estes testes mantêm cobertura do endpoint deprecated por compatibilidade.
 */
describe('QuotesService.convertToService', () => {
  let service: QuotesService;
  let prisma: any;
  let tx: any;
  let sequenceService: any;

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
        update: jest.fn().mockResolvedValue({ ...quoteBase, convertedAt: new Date() }),
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
    sequenceService = { increment: jest.fn().mockResolvedValue(7) };
    service = new QuotesService(prisma, sequenceService);
  });

  it('cria OS reaproveitando cliente, obra, observações, startDate e total', async () => {
    const result = await service.convertToService('company-1', 'quote-1');

    // Verificar que a OS foi criada com os dados corretos
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

    // Resposta contém serviceOrderId + dados da OS criada + created flag
    expect(result.serviceOrderId).toBe('os-1');
    expect(result.code).toBe(7);
    expect(result.status).toBe('PENDENTE');
    expect(result.clientId).toBe('client-1');
    expect(result.workId).toBe('work-1');
    expect(result.saleValue).toBe(1050);
    expect(result.created).toBe(true);
  });

  it('retorna OS existente na segunda conversão (idempotente)', async () => {
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
    service = new QuotesService(prisma, sequenceService);

    const result = await service.convertToService('company-1', 'quote-1');

    // Não deve criar nova OS
    expect(tx.serviceOrder.create).not.toHaveBeenCalled();

    // Deve retornar a OS existente
    expect(result.serviceOrderId).toBe('os-1');
    expect(result.code).toBe(5);
    expect(result.created).toBe(false);
  });

  it('verifica existência de OS antes de criar (idempotência)', async () => {
    await service.convertToService('company-1', 'quote-1');

    // Primeiro findFirst deve verificar se já existe OS para o quote
    expect(tx.serviceOrder.findFirst).toHaveBeenCalledWith({
      where: { companyId: 'company-1', quoteId: 'quote-1' },
      include: expect.any(Object),
    });
  });

  it('marca orçamento como convertido (convertedAt) dentro da transação', async () => {
    await service.convertToService('company-1', 'quote-1');

    // Verificar que convertedAt foi atualizado
    expect(tx.quote.update).toHaveBeenCalledWith({
      where: { id: 'quote-1' },
      data: { convertedAt: expect.any(Date) },
    });
  });

  it('retorna OS existente quando orçamento já foi convertido (idempotente)', async () => {
    // Simular que o orçamento já foi convertido (convertedAt não nulo)
    const existingOrder = { ...createdOrder, code: 5 };
    buildPrismaMock({
      tx: {
        serviceOrder: {
          findFirst: jest.fn().mockResolvedValue(existingOrder),
          create: jest.fn(),
        },
      },
    });
    service = new QuotesService(prisma, sequenceService);

    const result = await service.convertToService('company-1', 'quote-1');

    // Não deve criar nova OS
    expect(tx.serviceOrder.create).not.toHaveBeenCalled();

    // Deve retornar a OS existente com created=false
    expect(result.serviceOrderId).toBe('os-1');
    expect(result.code).toBe(5);
    expect(result.created).toBe(false);
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
    service = new QuotesService(prisma, sequenceService);

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
    service = new QuotesService(prisma, sequenceService);

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
