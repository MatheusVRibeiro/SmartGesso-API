import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import {
  BadRequestException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { QuotesService } from '../src/modules/quotes/quotes.service';
import { QuotesPublicController } from '../src/modules/quotes/quotes-public.controller';

/**
 * Testes dos Deep Links de Orçamento (token público).
 *
 * - Unitários: QuotesService.share / findPublicByToken /
 *   approvePublicByToken / rejectPublicByToken (Prisma mockado).
 * - E2E: rate limit agressivo (5 req/min por IP) nos endpoints públicos.
 */

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
  paymentTerms: 'AVISTA',
  validUntil: null,
  publicToken: null,
  sharedAt: null,
  observations: 'Observações internas confidenciais',
  startDate: new Date('2026-09-01T10:00:00.000Z'),
  convertedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  client: {
    id: 'client-1',
    name: 'Cliente Teste',
    document: '123.456.789-00',
    phone: '11999998888',
  },
  work: { id: 'work-1', name: 'Obra Teste' },
  items: [
    {
      itemType: 'SERVICO',
      name: 'Aplicação de gesso',
      description: 'Forro de gesso',
      quantity: 10,
      unit: 'm²',
      unitPrice: 100,
      total: 1000,
    },
  ],
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
  observations: 'Observações internas confidenciais',
  client: { id: 'client-1', name: 'Cliente Teste' },
  work: { id: 'work-1', name: 'Obra Teste' },
  quote: { id: 'quote-1', quoteNumber: 42, version: 1 },
  materials: [],
};

function buildMocks(quoteOverrides: Record<string, any> = {}) {
  const quote = { ...quoteBase, ...quoteOverrides };
  let tx: any;

  tx = {
    quote: {
      update: jest
        .fn()
        .mockImplementation(({ data }: any) =>
          Promise.resolve({ ...quote, ...data }),
        ),
    },
    quoteHistory: { create: jest.fn() },
    serviceOrder: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(createdOrder),
    },
  };

  const prisma: any = {
    quote: {
      findFirst: jest.fn().mockResolvedValue(quote),
      update: jest
        .fn()
        .mockImplementation(({ data }: any) =>
          Promise.resolve({ ...quote, ...data }),
        ),
    },
    $transaction: jest.fn(async (fn: (t: any) => any) => fn(tx)),
  };

  const sequenceService: any = { increment: jest.fn().mockResolvedValue(7) };
  const auditLogService: any = { log: jest.fn() };
  const notificationsService: any = { create: jest.fn().mockResolvedValue({}) };
  const pushService: any = {
    sendToCompany: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }),
  };

  const service = new QuotesService(
    prisma,
    sequenceService,
    auditLogService,
    notificationsService,
    pushService,
  );

  return {
    service,
    prisma,
    tx,
    sequenceService,
    auditLogService,
    notificationsService,
    pushService,
  };
}

describe('QuotesService.share (deep link)', () => {
  it('gera token único (64 chars hex) e atualiza publicToken + sharedAt + validUntil (+7 dias)', async () => {
    const { service, prisma } = buildMocks();

    const before = Date.now();
    const result = await service.share('company-1', 'quote-1');
    const after = Date.now();

    expect(result.publicToken).toMatch(/^[a-f0-9]{64}$/);
    expect(result.url).toBe(
      `https://app.smartgesso.com.br/o/${result.publicToken}`,
    );

    const updateData = prisma.quote.update.mock.calls[0][0].data;
    expect(updateData.publicToken).toBe(result.publicToken);
    expect(updateData.sharedAt).toBeInstanceOf(Date);
    expect(updateData.validUntil).toBeInstanceOf(Date);
    // validUntil deve ser ~7 dias à frente (default)
    const expected = before + 7 * 24 * 60 * 60 * 1000;
    expect(updateData.validUntil.getTime()).toBeGreaterThanOrEqual(expected);
    expect(updateData.validUntil.getTime()).toBeLessThanOrEqual(
      after + 7 * 24 * 60 * 60 * 1000,
    );
  });

  it('gera tokens únicos em shares consecutivos', async () => {
    const first = buildMocks();
    const second = buildMocks();

    const r1 = await first.service.share('company-1', 'quote-1');
    const r2 = await second.service.share('company-1', 'quote-1');

    expect(r1.publicToken).not.toBe(r2.publicToken);
  });

  it('respeita validUntil já definido (não sobrescreve)', async () => {
    const existingValidUntil = new Date('2026-12-31T00:00:00.000Z');
    const { service, prisma } = buildMocks({
      validUntil: existingValidUntil,
    });

    await service.share('company-1', 'quote-1');

    const updateData = prisma.quote.update.mock.calls[0][0].data;
    expect(updateData.validUntil).toEqual(existingValidUntil);
  });

  it('aceita expiryDays customizado no DTO', async () => {
    const { service, prisma } = buildMocks();

    await service.share('company-1', 'quote-1', { expiryDays: 30 });

    const updateData = prisma.quote.update.mock.calls[0][0].data;
    const expected = Date.now() + 30 * 24 * 60 * 60 * 1000;
    expect(updateData.validUntil.getTime()).toBeGreaterThan(
      expected - 5000,
    );
    expect(updateData.validUntil.getTime()).toBeLessThanOrEqual(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    );
  });

  it('é idempotente: se já existe publicToken, retorna o link sem atualizar', async () => {
    const existingToken = 'a'.repeat(64);
    const { service, prisma } = buildMocks({ publicToken: existingToken });

    const result = await service.share('company-1', 'quote-1');

    expect(result.publicToken).toBe(existingToken);
    expect(result.url).toBe(
      `https://app.smartgesso.com.br/o/${existingToken}`,
    );
    expect(prisma.quote.update).not.toHaveBeenCalled();
  });
});

describe('QuotesService.findPublicByToken (dados públicos)', () => {
  it('retorna dados públicos (itens, total, validade, cliente nome, status)', async () => {
    const validUntil = new Date('2026-12-31T00:00:00.000Z');
    const { service } = buildMocks({
      publicToken: 'tok-1',
      validUntil,
    });

    const result = await service.findPublicByToken('tok-1');

    expect(result).toEqual({
      quoteNumber: 42,
      version: 1,
      status: 'AGUARDANDO_APROVACAO',
      total: 1050,
      paymentMethod: 'AVISTA',
      paymentTerms: 'AVISTA',
      validUntil,
      client: { name: 'Cliente Teste' },
      work: { name: 'Obra Teste' },
      items: [
        {
          itemType: 'SERVICO',
          name: 'Aplicação de gesso',
          description: 'Forro de gesso',
          quantity: 10,
          unit: 'm²',
          unitPrice: 100,
          total: 1000,
        },
      ],
    });
  });

  it('NÃO expõe dados sensíveis (companyId, CPF, observações, telefone)', async () => {
    const { service } = buildMocks({ publicToken: 'tok-1' });

    const result: any = await service.findPublicByToken('tok-1');

    expect(result).not.toHaveProperty('companyId');
    expect(result).not.toHaveProperty('observations');
    expect(result).not.toHaveProperty('localAddress');
    expect(result.client).not.toHaveProperty('document');
    expect(result.client).not.toHaveProperty('phone');
    expect(JSON.stringify(result)).not.toContain('123.456.789-00');
    expect(JSON.stringify(result)).not.toContain(
      'Observações internas confidenciais',
    );
  });

  it('lança 404 para token inválido', async () => {
    const { service, prisma } = buildMocks();
    prisma.quote.findFirst.mockResolvedValue(null);

    await expect(service.findPublicByToken('token-inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lança 410 Gone para token expirado (validUntil no passado)', async () => {
    const { service } = buildMocks({
      publicToken: 'tok-1',
      validUntil: new Date('2020-01-01T00:00:00.000Z'),
    });

    await expect(service.findPublicByToken('tok-1')).rejects.toThrow(
      GoneException,
    );
  });

  it('busca filtra soft delete (deletedAt: null no where)', async () => {
    const { service, prisma } = buildMocks({ publicToken: 'tok-1' });

    await service.findPublicByToken('tok-1');

    expect(prisma.quote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          publicToken: 'tok-1',
          deletedAt: null,
        }),
      }),
    );
  });
});

describe('QuotesService.approvePublicByToken (aprovação pública)', () => {
  it('aprova pelo companyId do orçamento, cria ServiceOrder e push "Cliente aprovou pelo link"', async () => {
    const validUntil = new Date('2026-12-31T00:00:00.000Z');
    const {
      service,
      tx,
      notificationsService,
      pushService,
      auditLogService,
    } = buildMocks({
      publicToken: 'tok-1',
      validUntil,
    });

    const result = await service.approvePublicByToken('tok-1', '1.2.3.4');

    expect(result.status).toBe('APROVADO');
    expect(result.serviceOrderId).toBe('os-1');
    expect(result.serviceOrderCreated).toBe(true);

    // OS criada com o companyId do próprio orçamento
    const createData = tx.serviceOrder.create.mock.calls[0][0].data;
    expect(createData.companyId).toBe('company-1');
    expect(createData.quoteId).toBe('quote-1');

    // Push notification pro gestor
    expect(pushService.sendToCompany).toHaveBeenCalledWith(
      'company-1',
      expect.objectContaining({
        title: 'Cliente aprovou pelo link',
      }),
    );

    // Notificação interna
    expect(notificationsService.create).toHaveBeenCalledWith(
      'company-1',
      expect.objectContaining({
        type: 'QUOTE_APPROVED',
        title: 'Cliente aprovou pelo link',
      }),
    );

    // Audit log da aprovação pública
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'APPROVE_PUBLIC',
        entity: 'Quote',
        entityId: 'quote-1',
        details: expect.objectContaining({
          source: 'deep-link',
          ip: '1.2.3.4',
        }),
      }),
    );
  });

  it('lança 404 para token inválido', async () => {
    const { service, prisma } = buildMocks();
    prisma.quote.findFirst.mockResolvedValue(null);

    await expect(service.approvePublicByToken('inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lança 410 Gone para token expirado', async () => {
    const { service } = buildMocks({
      publicToken: 'tok-1',
      validUntil: new Date('2020-01-01T00:00:00.000Z'),
    });

    await expect(service.approvePublicByToken('tok-1')).rejects.toThrow(
      GoneException,
    );
  });
});

describe('QuotesService.rejectPublicByToken (rejeição pública)', () => {
  it('rejeita com a nota do cliente e registra audit log', async () => {
    const validUntil = new Date('2026-12-31T00:00:00.000Z');
    const { service, tx, auditLogService } = buildMocks({
      publicToken: 'tok-1',
      validUntil,
    });

    const result = await service.rejectPublicByToken(
      'tok-1',
      'Preço acima do orçamento',
    );

    expect(result.status).toBe('REJEITADO');
    expect(result.quoteNumber).toBe(42);

    // Histórico criado com a nota
    expect(tx.quoteHistory.create).toHaveBeenCalledWith({
      data: {
        quoteId: 'quote-1',
        status: 'REJEITADO',
        note: 'Preço acima do orçamento',
      },
    });

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REJECT_PUBLIC',
        details: expect.objectContaining({
          note: 'Preço acima do orçamento',
          source: 'deep-link',
        }),
      }),
    );
  });

  it('lança 400 quando a nota é vazia/só espaços', async () => {
    const { service } = buildMocks({
      publicToken: 'tok-1',
      validUntil: new Date('2026-12-31T00:00:00.000Z'),
    });

    await expect(service.rejectPublicByToken('tok-1', '   ')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('lança 404 para token inválido', async () => {
    const { service, prisma } = buildMocks();
    prisma.quote.findFirst.mockResolvedValue(null);

    await expect(
      service.rejectPublicByToken('inexistente', 'motivo'),
    ).rejects.toThrow(NotFoundException);
  });

  it('lança 410 Gone para token expirado', async () => {
    const { service } = buildMocks({
      publicToken: 'tok-1',
      validUntil: new Date('2020-01-01T00:00:00.000Z'),
    });

    await expect(
      service.rejectPublicByToken('tok-1', 'motivo'),
    ).rejects.toThrow(GoneException);
  });
});

describe('Endpoints públicos de orçamento (e2e)', () => {
  let app: INestApplication;
  let quotesServiceMock: any;

  beforeAll(async () => {
    quotesServiceMock = {
      findPublicByToken: jest.fn().mockResolvedValue({ quoteNumber: 42 }),
      approvePublicByToken: jest.fn().mockResolvedValue({ status: 'APROVADO' }),
      rejectPublicByToken: jest.fn().mockResolvedValue({ status: 'REJEITADO' }),
    };

    const mod = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
      controllers: [QuotesPublicController],
      providers: [
        { provide: QuotesService, useValue: quotesServiceMock },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = mod.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /public/quotes/:token responde sem autenticação', async () => {
    const res = await request(app.getHttpServer())
      .get('/public/quotes/tok-e2e-1')
      .expect(200);

    expect(res.body).toEqual({ quoteNumber: 42 });
    expect(quotesServiceMock.findPublicByToken).toHaveBeenCalledWith(
      'tok-e2e-1',
    );
  });

  it('POST /public/quotes/:token/approve aprova sem autenticação', async () => {
    await request(app.getHttpServer())
      .post('/public/quotes/tok-e2e-1/approve')
      .expect(201);

    expect(quotesServiceMock.approvePublicByToken).toHaveBeenCalledWith(
      'tok-e2e-1',
      expect.anything(),
    );
  });

  it('POST /public/quotes/:token/reject valida a nota (400 sem note)', async () => {
    await request(app.getHttpServer())
      .post('/public/quotes/tok-e2e-1/reject')
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .post('/public/quotes/tok-e2e-1/reject')
      .send({ note: ' ' })
      .expect(400);

    expect(quotesServiceMock.rejectPublicByToken).not.toHaveBeenCalled();
  });

  it('POST /public/quotes/:token/reject rejeita com nota válida', async () => {
    await request(app.getHttpServer())
      .post('/public/quotes/tok-e2e-1/reject')
      .send({ note: 'Muito caro' })
      .expect(201);

    expect(quotesServiceMock.rejectPublicByToken).toHaveBeenCalledWith(
      'tok-e2e-1',
      'Muito caro',
    );
  });
});

describe('Rate limit agressivo nos endpoints públicos (5 req/min por IP)', () => {
  let app: INestApplication;

  // App isolado: o ThrottlerGuard usa storage em memória por processo e a
  // chave é por rota + IP (não por token). Isolar em outro app evita
  // interferência com os testes acima.
  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
      controllers: [QuotesPublicController],
      providers: [
        {
          provide: QuotesService,
          useValue: {
            findPublicByToken: jest.fn().mockResolvedValue({ quoteNumber: 42 }),
          },
        },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('6ª requisição em 1 minuto retorna 429 com Retry-After', async () => {
    // Limite da rota: 5 req/min por IP
    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer())
        .get('/public/quotes/tok-rate-limit')
        .expect(200);
    }

    const res = await request(app.getHttpServer())
      .get('/public/quotes/tok-rate-limit')
      .expect(429);

    expect(res.headers['retry-after']).toBeDefined();
  });
});
