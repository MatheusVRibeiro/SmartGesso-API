import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { CreatePaymentDto } from '../src/modules/payments/dto/create-payment.dto';
import { UpdatePaymentDto } from '../src/modules/payments/dto/update-payment.dto';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Testes unitários de integridade financeira Payment ↔ OS (V5 ETAPA 1, TASK 4).
 *
 * PrismaService é mockado — nenhum banco é acessado.
 *
 * Cobre:
 *  - payment cross-tenant (OS de outra empresa) rejeitado;
 *  - mismatch cliente ↔ OS rejeitado no create;
 *  - mismatch rejeitado no update quando só o clientId muda (OS mantida);
 *  - vínculo válido aceito no create e no update;
 *  - PAYMENT_INCLUDE retorna a serviceOrder (id, code, clientId).
 */
describe('PaymentsService — integridade Payment ↔ OS', () => {
  let service: PaymentsService;
  let prisma: any;

  const COMPANY_ID = 'company-1';
  const CLIENT_A = 'client-a';
  const CLIENT_B = 'client-b';
  const SERVICE_ORDER_ID = 'so-1';
  const PAYMENT_ID = 'pay-1';

  beforeEach(() => {
    prisma = {
      payment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      client: {
        findFirst: jest.fn(),
      },
      quote: {
        findFirst: jest.fn(),
      },
      serviceOrder: {
        findFirst: jest.fn(),
      },
    };
    service = new PaymentsService(
      prisma,
      { create: jest.fn().mockResolvedValue({}) } as any,
      { sendToCompany: jest.fn().mockResolvedValue({ sent: 0 }), create: jest.fn().mockResolvedValue({}) } as any,
    );
  });

  // ── Helpers ──────────────────────────────────────────────

  function mockServiceOrder(overrides: Record<string, any> = {}) {
    return {
      id: SERVICE_ORDER_ID,
      companyId: COMPANY_ID,
      clientId: CLIENT_A,
      code: 42,
      ...overrides,
    };
  }

  function mockPayment(overrides: Record<string, any> = {}) {
    return {
      id: PAYMENT_ID,
      companyId: COMPANY_ID,
      clientId: CLIENT_A,
      serviceOrderId: SERVICE_ORDER_ID,
      amount: new Decimal(500.0),
      installments: [],
      client: { id: CLIENT_A, name: 'Cliente A' },
      serviceOrder: { id: SERVICE_ORDER_ID, code: 42, clientId: CLIENT_A },
      ...overrides,
    };
  }

  function baseCreateDto(overrides: Partial<CreatePaymentDto> = {}): CreatePaymentDto {
    return {
      clientId: CLIENT_A,
      amount: 500,
      paymentMethod: 'PIX',
      serviceOrderId: SERVICE_ORDER_ID,
      ...overrides,
    } as CreatePaymentDto;
  }

  // ── Tenant isolation ─────────────────────────────────────

  it('create: rejeita OS de outra empresa (cross-tenant)', async () => {
    // findFirst respeita o where { companyId } — OS de outra empresa não é encontrada
    prisma.client.findFirst.mockResolvedValue({ id: CLIENT_A });
    prisma.serviceOrder.findFirst.mockResolvedValue(null);

    await expect(
      service.create(COMPANY_ID, baseCreateDto()),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.serviceOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: SERVICE_ORDER_ID,
          companyId: COMPANY_ID,
          deletedAt: null,
        }),
      }),
    );
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('update: rejeita OS de outra empresa (cross-tenant)', async () => {
    prisma.payment.findFirst.mockResolvedValue(mockPayment());
    prisma.serviceOrder.findFirst.mockResolvedValue(null);

    // findOne passa (pagamento é da empresa), mas a OS não pertence à empresa
    // → BadRequestException de ensureServiceOrderBelongsToCompany
    await expect(
      service.update(COMPANY_ID, PAYMENT_ID, {
        serviceOrderId: SERVICE_ORDER_ID,
      } as UpdatePaymentDto),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.serviceOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: COMPANY_ID,
          deletedAt: null,
        }),
      }),
    );
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  // ── Mismatch cliente ↔ OS no create ──────────────────────

  it('create: rejeita pagamento cujo cliente difere do cliente da OS', async () => {
    prisma.client.findFirst.mockResolvedValue({ id: CLIENT_B });
    prisma.serviceOrder.findFirst.mockResolvedValue(
      mockServiceOrder({ clientId: CLIENT_A }),
    );

    await expect(
      service.create(COMPANY_ID, baseCreateDto({ clientId: CLIENT_B })),
    ).rejects.toThrow(
      new BadRequestException(
        'O cliente do pagamento deve corresponder ao cliente da ordem de serviço',
      ),
    );

    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  // ── Mismatch no update quando só o clientId muda ─────────

  it('update: rejeita quando só o clientId muda e passa a divergir do cliente da OS mantida', async () => {
    // Pagamento existente vinculado à OS (cliente da OS = CLIENT_A)
    prisma.payment.findFirst.mockResolvedValue(mockPayment());
    prisma.client.findFirst.mockResolvedValue({ id: CLIENT_B });
    prisma.serviceOrder.findFirst.mockResolvedValue(
      mockServiceOrder({ clientId: CLIENT_A }),
    );

    // dto só muda o clientId — a OS existente é mantida
    await expect(
      service.update(COMPANY_ID, PAYMENT_ID, {
        clientId: CLIENT_B,
      } as UpdatePaymentDto),
    ).rejects.toThrow(
      new BadRequestException(
        'O cliente do pagamento deve corresponder ao cliente da ordem de serviço',
      ),
    );

    // A OS efetiva (a mantida) foi buscada para validar a combinação
    expect(prisma.serviceOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: SERVICE_ORDER_ID,
          companyId: COMPANY_ID,
        }),
      }),
    );
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('update: rejeita quando só a OS muda e passa a divergir do cliente mantido', async () => {
    prisma.payment.findFirst.mockResolvedValue(mockPayment());
    prisma.serviceOrder.findFirst.mockResolvedValue(
      mockServiceOrder({ clientId: CLIENT_B }),
    );

    await expect(
      service.update(COMPANY_ID, PAYMENT_ID, {
        serviceOrderId: 'so-2',
      } as UpdatePaymentDto),
    ).rejects.toThrow(
      new BadRequestException(
        'O cliente do pagamento deve corresponder ao cliente da ordem de serviço',
      ),
    );

    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  // ── Vínculos válidos aceitos ─────────────────────────────

  it('create: aceita pagamento com cliente igual ao cliente da OS', async () => {
    prisma.client.findFirst.mockResolvedValue({ id: CLIENT_A });
    prisma.serviceOrder.findFirst.mockResolvedValue(
      mockServiceOrder({ clientId: CLIENT_A }),
    );
    prisma.payment.create.mockResolvedValue(mockPayment());

    const result = await service.create(COMPANY_ID, baseCreateDto());

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          client: { connect: { id: CLIENT_A } },
          serviceOrder: { connect: { id: SERVICE_ORDER_ID } },
        }),
      }),
    );
    expect(result.serviceOrder).toEqual({
      id: SERVICE_ORDER_ID,
      code: 42,
      clientId: CLIENT_A,
    });
  });

  it('update: aceita troca para OS do mesmo cliente efetivo', async () => {
    prisma.payment.findFirst.mockResolvedValue(mockPayment());
    prisma.serviceOrder.findFirst.mockResolvedValue(
      mockServiceOrder({ clientId: CLIENT_A }),
    );
    prisma.payment.update.mockResolvedValue(
      mockPayment({ serviceOrderId: 'so-2' }),
    );

    const result = await service.update(COMPANY_ID, PAYMENT_ID, {
      serviceOrderId: 'so-2',
    } as UpdatePaymentDto);

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PAYMENT_ID },
        data: expect.objectContaining({ serviceOrderId: 'so-2' }),
      }),
    );
    expect(result.serviceOrder).toBeDefined();
  });

  it('update: aceita mudança de clientId compatível com o cliente da OS mantida', async () => {
    // Cliente da OS é CLIENT_B; o update troca o clientId do pagamento para CLIENT_B
    prisma.payment.findFirst.mockResolvedValue(
      mockPayment({ clientId: CLIENT_A }),
    );
    prisma.client.findFirst.mockResolvedValue({ id: CLIENT_B });
    prisma.serviceOrder.findFirst.mockResolvedValue(
      mockServiceOrder({ clientId: CLIENT_B }),
    );
    prisma.payment.update.mockResolvedValue(
      mockPayment({ clientId: CLIENT_B }),
    );

    const result = await service.update(COMPANY_ID, PAYMENT_ID, {
      clientId: CLIENT_B,
    } as UpdatePaymentDto);

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clientId: CLIENT_B }),
      }),
    );
    expect(result.clientId).toBe(CLIENT_B);
  });

  // ── Pagamento sem OS permanece válido ────────────────────

  it('create: aceita pagamento sem serviceOrderId (validação não se aplica)', async () => {
    prisma.client.findFirst.mockResolvedValue({ id: CLIENT_A });
    prisma.payment.create.mockResolvedValue(
      mockPayment({ serviceOrderId: null, serviceOrder: null }),
    );

    const result = await service.create(
      COMPANY_ID,
      baseCreateDto({ serviceOrderId: undefined }),
    );

    expect(prisma.serviceOrder.findFirst).not.toHaveBeenCalled();
    expect(result.serviceOrder).toBeNull();
  });

  // ── PAYMENT_INCLUDE inclui a serviceOrder ────────────────

  it('findOne: inclui serviceOrder com select mínimo (id, code, clientId)', async () => {
    prisma.payment.findFirst.mockResolvedValue(mockPayment());

    await service.findOne(COMPANY_ID, PAYMENT_ID);

    expect(prisma.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PAYMENT_ID, companyId: COMPANY_ID, deletedAt: null },
        include: expect.objectContaining({
          serviceOrder: {
            select: { id: true, code: true, clientId: true },
          },
        }),
      }),
    );
  });
});
