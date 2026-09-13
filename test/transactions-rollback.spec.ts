import { BadRequestException } from '@nestjs/common';
import { QuoteStatus } from '@prisma/client';
import { QuotesService } from '../src/modules/quotes/quotes.service';
import { ServiceOrdersService } from '../src/modules/service-orders/service-orders.service';

/**
 * ETAPA 2 — Testes de rollback transacional (deleteMany dentro de $transaction).
 *
 * Estratégia: o mock de $transaction apenas EXECUTA o callback recebido
 * (simulando o comportamento real do Prisma Interactive Transaction) e
 * propaga qualquer throw do callback para fora da promise.
 *
 * Como o deleteMany acontece DENTRO do callback da transação, o rollback
 * no banco real é implícito quando o callback lança erro. O que estes
 * testes provam é a propriedade que garante o rollback:
 *   1. o erro lançado APÓS o deleteMany propaga (promise rejeita); e
 *   2. NENHUMA operação posterior da transação executa (nada novo é
 *      gravado depois do ponto de falha).
 *
 * PrismaService é mockado — nenhum banco é acessado.
 */

const TX_FAILURE = new Error('falha simulada após deleteMany');

describe('Rollback transacional — QuotesService.update', () => {
  let service: QuotesService;
  let prisma: any;
  let tx: any;

  const existingQuote = {
    id: 'quote-1',
    companyId: 'company-1',
    clientId: 'client-1',
    workId: 'work-1',
    quoteNumber: 42,
    version: 1,
    status: 'RASCUNHO',
    subtotal: 1000,
    discount: 0,
    marginPct: 0,
    total: 1000,
    items: [
      {
        id: 'item-1',
        quoteId: 'quote-1',
        itemType: 'PRODUTO',
        name: 'Item antigo',
        description: null,
        quantity: 10,
        unit: 'un',
        unitPrice: 100,
        total: 1000,
      },
    ],
  };

  const updatedQuote = {
    ...existingQuote,
    status: 'ENVIADO',
    items: [],
  };

  const dto = {
    status: 'ENVIADO' as QuoteStatus,
    items: [
      {
        itemType: 'PRODUTO' as const,
        name: 'Item novo',
        quantity: 2,
        unit: 'un',
        unitPrice: 50,
      },
    ],
  };

  function buildMocks(options: { failOnQuoteUpdate?: boolean } = {}) {
    tx = {
      quoteItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      quote: {
        update: options.failOnQuoteUpdate
          ? jest.fn().mockRejectedValue(TX_FAILURE)
          : jest.fn().mockResolvedValue(updatedQuote),
      },
      quoteHistory: {
        create: jest.fn(),
      },
    };

    prisma = {
      quote: {
        // 1ª chamada: findOne do update; 2ª chamada: versão mais recente
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(existingQuote)
          .mockResolvedValueOnce(null),
      },
      client: { findFirst: jest.fn().mockResolvedValue({ id: 'client-1' }) },
      work: { findFirst: jest.fn().mockResolvedValue({ id: 'work-1' }) },
      $transaction: jest.fn(async (fn: (t: any) => Promise<any>) => fn(tx)),
    };

    service = new QuotesService(
      prisma,
      { increment: jest.fn() } as any,
      { log: jest.fn() } as any,
      { create: jest.fn() } as any,
      { sendToCompany: jest.fn() } as any,
    );
  }

  it('caso feliz: deleteMany → quote.update → quoteHistory.create executam na ordem', async () => {
    buildMocks();

    const result = await service.update('company-1', 'quote-1', dto);

    expect(tx.quoteItem.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.quoteItem.deleteMany).toHaveBeenCalledWith({
      where: { quoteId: 'quote-1' },
    });
    expect(tx.quote.update).toHaveBeenCalledTimes(1);
    expect(tx.quoteHistory.create).toHaveBeenCalledTimes(1);
    expect(tx.quoteHistory.create).toHaveBeenCalledWith({
      data: {
        quoteId: 'quote-1',
        status: 'ENVIADO',
        note: 'Status alterado de RASCUNHO para ENVIADO',
      },
    });
    expect(result.status).toBe('ENVIADO');

    // Ordem exata das operações dentro da transação
    const invocationOrder = [
      tx.quoteItem.deleteMany.mock.invocationCallOrder[0],
      tx.quote.update.mock.invocationCallOrder[0],
      tx.quoteHistory.create.mock.invocationCallOrder[0],
    ];
    expect([...invocationOrder].sort((a, b) => a - b)).toEqual(invocationOrder);
  });

  it('erro após deleteMany: promise rejeita e NENHUM quoteHistory.create acontece', async () => {
    buildMocks({ failOnQuoteUpdate: true });

    await expect(
      service.update('company-1', 'quote-1', dto),
    ).rejects.toThrow('falha simulada após deleteMany');

    // O deleteMany chegou a ser chamado (dentro da tx)…
    expect(tx.quoteItem.deleteMany).toHaveBeenCalledTimes(1);
    // …mas a falha no quote.update interrompeu a transação:
    expect(tx.quote.update).toHaveBeenCalledTimes(1);
    // Nada posterior executa → no banco real o Prisma desfaz o deleteMany.
    expect(tx.quoteHistory.create).not.toHaveBeenCalled();
  });

  it('erro após deleteMany: BadRequestException (versão mais recente) propaga antes da tx', async () => {
    buildMocks();
    // Simula existência de versão mais recente do mesmo orçamento
    prisma.quote.findFirst
      .mockReset()
      .mockResolvedValueOnce(existingQuote)
      .mockResolvedValueOnce({ version: 2, id: 'quote-2' });

    await expect(
      service.update('company-1', 'quote-1', dto),
    ).rejects.toThrow(BadRequestException);

    // A transação nem chega a abrir: nada foi deletado nem criado
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.quoteItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.quoteHistory.create).not.toHaveBeenCalled();
  });
});

describe('Rollback transacional — ServiceOrdersService.update', () => {
  let service: ServiceOrdersService;
  let prisma: any;
  let tx: any;

  const existingOrder = {
    id: 'os-1',
    companyId: 'company-1',
    clientId: 'client-1',
    workId: 'work-1',
    code: 7,
    status: 'PENDENTE',
    cost: null,
    saleValue: null,
    profit: null,
    materials: [
      {
        id: 'mat-1',
        serviceOrderId: 'os-1',
        materialName: 'Placa de gesso',
        quantity: 10,
        unit: 'un',
      },
    ],
  };

  const updatedOrder = {
    ...existingOrder,
    status: 'EM_ANDAMENTO',
    materials: [],
  };

  const dto = {
    status: 'EM_ANDAMENTO' as const,
    materials: [
      { materialName: 'Placa nova', quantity: 5, unit: 'un' },
    ],
  };

  function buildMocks(options: { failOnOrderUpdate?: boolean } = {}) {
    tx = {
      serviceOrderMaterial: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(), // NÃO deve ser chamado: materiais entram via nested create
      },
      serviceOrder: {
        update: options.failOnOrderUpdate
          ? jest.fn().mockRejectedValue(TX_FAILURE)
          : jest.fn().mockResolvedValue(updatedOrder),
      },
    };

    prisma = {
      serviceOrder: {
        findFirst: jest.fn().mockResolvedValue(existingOrder),
      },
      client: { findFirst: jest.fn().mockResolvedValue({ id: 'client-1' }) },
      work: { findFirst: jest.fn().mockResolvedValue({ id: 'work-1' }) },
      $transaction: jest.fn(async (fn: (t: any) => Promise<any>) => fn(tx)),
    };

    service = new ServiceOrdersService(
      prisma,
      { increment: jest.fn() } as any,
    );
  }

  it('caso feliz: deleteMany → serviceOrder.update (com nested create de materiais) na ordem', async () => {
    buildMocks();

    const result = await service.update('company-1', 'os-1', dto);

    expect(tx.serviceOrderMaterial.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.serviceOrderMaterial.deleteMany).toHaveBeenCalledWith({
      where: { serviceOrderId: 'os-1' },
    });
    expect(tx.serviceOrder.update).toHaveBeenCalledTimes(1);

    // Materiais são recriados via nested create dentro do update
    const updateCall = tx.serviceOrder.update.mock.calls[0][0];
    expect(updateCall.data.materials).toEqual({
      create: [{ materialName: 'Placa nova', quantity: 5, unit: 'un' }],
    });

    // Nenhuma criação avulsa fora da ordem esperada
    expect(tx.serviceOrderMaterial.create).not.toHaveBeenCalled();
    expect(result.status).toBe('EM_ANDAMENTO');

    // Ordem exata: deleteMany antes do update
    expect(
      tx.serviceOrderMaterial.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.serviceOrder.update.mock.invocationCallOrder[0]);
  });

  it('erro após deleteMany: promise rejeita e serviceOrderMaterial.create NUNCA é chamado', async () => {
    buildMocks({ failOnOrderUpdate: true });

    await expect(
      service.update('company-1', 'os-1', dto),
    ).rejects.toThrow('falha simulada após deleteMany');

    // O deleteMany chegou a ser chamado (dentro da tx)…
    expect(tx.serviceOrderMaterial.deleteMany).toHaveBeenCalledTimes(1);
    // …mas a falha no serviceOrder.update interrompeu a transação:
    expect(tx.serviceOrder.update).toHaveBeenCalledTimes(1);
    // Nada posterior executa → no banco real o Prisma desfaz o deleteMany.
    expect(tx.serviceOrderMaterial.create).not.toHaveBeenCalled();
  });

  it('erro após deleteMany: falha também interrompe recriação de materiais (nested create não persiste)', async () => {
    buildMocks({ failOnOrderUpdate: true });

    await expect(
      service.update('company-1', 'os-1', dto),
    ).rejects.toThrow(TX_FAILURE);

    // O payload de recriação dos materiais estava no update que falhou —
    // como ele nunca persistiu, nenhum material novo sobrevive ao rollback.
    const updateCall = tx.serviceOrder.update.mock.calls[0][0];
    expect(updateCall.data.materials.create).toHaveLength(1);
    expect(tx.serviceOrderMaterial.create).not.toHaveBeenCalled();
  });
});
