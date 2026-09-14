import { Prisma } from '@prisma/client';
import { QuotesService } from '../src/modules/quotes/quotes.service';

/**
 * Testes unitários da aprovação sob concorrência (approve).
 *
 * Cenário: duas requests aprovam o mesmo orçamento quase simultaneamente.
 * A request perdedora recebe P2002 (UNIQUE companyId+quoteId) no create da OS
 * e deve re-buscar a OS criada pela concorrente, retornando
 * serviceOrderCreated=false com a MESMA OS — sem lançar.
 *
 * PrismaService é mockado — nenhum banco é acessado.
 */
describe('QuotesService.approve (concorrência — P2002 no create da OS)', () => {
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

  // OS que a request concorrente já criou (a "vencedora" da corrida)
  const racedOrder = {
    id: 'os-race',
    companyId: 'company-1',
    clientId: 'client-1',
    workId: 'work-1',
    quoteId: 'quote-1',
    code: 9,
    status: 'PENDENTE',
    scheduledDate: new Date('2026-09-01T10:00:00.000Z'),
    saleValue: 1050,
    observations: 'Observações do orçamento',
    client: { id: 'client-1', name: 'Cliente Teste' },
    work: { id: 'work-1', name: 'Obra Teste' },
    quote: { id: 'quote-1', quoteNumber: 42, version: 1 },
    materials: [],
  };

  const p2002Error = new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`companyId`,`quoteId`)',
    {
      code: 'P2002',
      clientVersion: '6.12.0',
      meta: { target: ['ServiceOrder_companyId_quoteId_key'] },
    },
  );

  function buildTx(serviceOrderOverride: Partial<any> = {}) {
    tx = {
      serviceOrder: {
        // 1ª chamada: check inicial de idempotência (não existe OS ainda).
        // 2ª chamada: re-busca após P2002 (encontra a OS da concorrente).
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(racedOrder),
        create: jest.fn().mockRejectedValue(p2002Error),
        ...serviceOrderOverride,
      },
      quote: {
        update: jest.fn().mockResolvedValue({ ...quoteBase, status: 'APROVADO' }),
        create: jest.fn(),
      },
      quoteHistory: {
        create: jest.fn(),
      },
    };

    prisma = {
      quote: {
        findFirst: jest.fn().mockResolvedValue(quoteBase),
      },
      $transaction: jest.fn(async (fn: (t: any) => any) => fn(tx)),
    };

    service = new QuotesService(
      prisma,
      { increment: jest.fn().mockResolvedValue(11) } as any,
      { log: jest.fn() } as any,
      { create: jest.fn() } as any,
      { sendToCompany: jest.fn() } as any,
    );
  }

  it('create perde a corrida (P2002): retorna a MESMA OS com serviceOrderCreated=false, sem lançar', async () => {
    buildTx();

    const result = await service.approve('company-1', 'quote-1');

    // tentou criar exatamente uma vez e falhou com P2002
    expect(tx.serviceOrder.create).toHaveBeenCalledTimes(1);

    // re-busca pós-P2002 usou o escopo correto (companyId + quoteId)
    expect(tx.serviceOrder.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { companyId: 'company-1', quoteId: 'quote-1' },
      }),
    );

    // retornou a OS criada pela request concorrente (mesma OS, code 9)
    expect(result.serviceOrder.id).toBe('os-race');
    expect(result.serviceOrder.code).toBe(9);
    expect(result.serviceOrderCreated).toBe(false);

    // quote segue aprovado
    expect(result.quote.status).toBe('APROVADO');
  });

  it('seta convertedAt na transaction mesmo quando a OS já existia (ramo pós-P2002)', async () => {
    buildTx();

    await service.approve('company-1', 'quote-1');

    expect(tx.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'quote-1' },
        data: { convertedAt: expect.any(Date) },
      }),
    );
  });

  it('erro genérico no create NÃO é mascarado como corrida (re-throw, sem re-busca extra)', async () => {
    const boom = new Error('Falha de banco genérica');
    buildTx({
      findFirst: jest.fn().mockResolvedValueOnce(null),
      create: jest.fn().mockRejectedValue(boom),
    });

    await expect(service.approve('company-1', 'quote-1')).rejects.toThrow(boom);

    // apenas o check inicial de idempotência — nenhum "recovery" foi tentado
    expect(tx.serviceOrder.findFirst).toHaveBeenCalledTimes(1);
  });

  it('P2002 sem OS correspondente na re-busca é re-lançado (não mascarar)', async () => {
    buildTx({
      findFirst: jest
        .fn()
        .mockResolvedValueOnce(null) // check inicial
        .mockResolvedValueOnce(null), // re-busca pós-P2002: nada encontrado
      create: jest.fn().mockRejectedValue(p2002Error),
    });

    await expect(service.approve('company-1', 'quote-1')).rejects.toBe(
      p2002Error,
    );
  });
});
