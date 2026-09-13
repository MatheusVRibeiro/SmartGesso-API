import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuoteFollowUpsService } from '../src/modules/quote-follow-ups/quote-follow-ups.service';
import { QuoteFollowUpStatus, QuoteFollowUpType } from '@prisma/client';

/**
 * Testes unitários do QuoteFollowUpsService — ETAPA 12.
 *
 * PrismaService é mockado — nenhum banco é acessado.
 *
 * Cobre: CRUD, transições de status, tenant isolation e agenda do dia (listToday).
 */
describe('QuoteFollowUpsService', () => {
  let service: QuoteFollowUpsService;
  let prisma: any;

  const COMPANY_ID = 'company-1';
  const OTHER_COMPANY_ID = 'company-2';
  const QUOTE_ID = 'quote-1';
  const FOLLOW_UP_ID = 'fu-1';
  const USER_ID = 'user-1';

  beforeEach(() => {
    prisma = {
      quote: { findFirst: jest.fn() },
      quoteFollowUp: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new QuoteFollowUpsService(prisma);
  });

  // ── Helpers ──────────────────────────────────────────────

  function mockQuoteExists() {
    prisma.quote.findFirst.mockResolvedValue({ id: QUOTE_ID });
  }

  function mockQuoteNotFound() {
    prisma.quote.findFirst.mockResolvedValue(null);
  }

  function mockFollowUp(overrides: Record<string, any> = {}) {
    return {
      id: FOLLOW_UP_ID,
      companyId: COMPANY_ID,
      quoteId: QUOTE_ID,
      type: 'CALL' as QuoteFollowUpType,
      notes: 'Ligar para o cliente',
      scheduledAt: new Date('2026-08-25T10:00:00Z'),
      doneAt: null,
      status: 'PENDING' as QuoteFollowUpStatus,
      createdById: USER_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      quote: { id: QUOTE_ID, quoteNumber: 42, version: 1 },
      createdBy: { id: USER_ID, name: 'Test User' },
      ...overrides,
    };
  }

  // ── listByQuote ──────────────────────────────────────────

  describe('listByQuote', () => {
    it('retorna follow-ups do orçamento quando ele pertence à empresa', async () => {
      mockQuoteExists();
      const followUps = [mockFollowUp(), mockFollowUp({ id: 'fu-2' })];
      prisma.quoteFollowUp.findMany.mockResolvedValue(followUps);

      const result = await service.listByQuote(COMPANY_ID, QUOTE_ID);

      expect(prisma.quoteFollowUp.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: COMPANY_ID,
            quoteId: QUOTE_ID,
            deletedAt: null,
          }),
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('lança BadRequestException quando o orçamento não pertence à empresa (tenant isolation)', async () => {
      mockQuoteNotFound();

      await expect(
        service.listByQuote(COMPANY_ID, QUOTE_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── create ───────────────────────────────────────────────

  describe('create', () => {
    it('cria follow-up com status PENDING, type e scheduledAt convertido', async () => {
      mockQuoteExists();
      const created = mockFollowUp();
      prisma.quoteFollowUp.create.mockResolvedValue(created);

      const result = await service.create(COMPANY_ID, USER_ID, QUOTE_ID, {
        type: QuoteFollowUpType.CALL,
        notes: 'Ligar para o cliente',
        scheduledAt: '2026-08-25T10:00:00.000Z',
      });

      expect(prisma.quoteFollowUp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            quoteId: QUOTE_ID,
            type: QuoteFollowUpType.CALL,
            notes: 'Ligar para o cliente',
            scheduledAt: new Date('2026-08-25T10:00:00.000Z'),
            status: QuoteFollowUpStatus.PENDING,
            createdById: USER_ID,
          }),
        }),
      );
      expect(result.status).toBe('PENDING');
    });

    it('define createdById null quando userId não é informado', async () => {
      mockQuoteExists();
      prisma.quoteFollowUp.create.mockResolvedValue(mockFollowUp());

      await service.create(COMPANY_ID, undefined, QUOTE_ID, {
        type: QuoteFollowUpType.WHATSAPP,
      });

      expect(prisma.quoteFollowUp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ createdById: null }),
        }),
      );
    });

    it('lança BadRequestException quando o orçamento é de outra empresa', async () => {
      mockQuoteNotFound();

      await expect(
        service.create(OTHER_COMPANY_ID, USER_ID, QUOTE_ID, {
          type: QuoteFollowUpType.EMAIL,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── update ───────────────────────────────────────────────

  describe('update', () => {
    it('atualiza apenas os campos informados', async () => {
      prisma.quoteFollowUp.findFirst.mockResolvedValue(mockFollowUp());
      prisma.quoteFollowUp.update.mockResolvedValue(
        mockFollowUp({ notes: 'Atualizado', scheduledAt: new Date('2026-08-26T09:00:00Z') }),
      );

      const result = await service.update(COMPANY_ID, FOLLOW_UP_ID, {
        notes: 'Atualizado',
        scheduledAt: '2026-08-26T09:00:00.000Z',
      });

      expect(prisma.quoteFollowUp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: FOLLOW_UP_ID },
          data: expect.objectContaining({
            notes: 'Atualizado',
            scheduledAt: new Date('2026-08-26T09:00:00.000Z'),
          }),
        }),
      );
      expect(result.notes).toBe('Atualizado');
    });

    it('não envia campos ausentes no data', async () => {
      prisma.quoteFollowUp.findFirst.mockResolvedValue(mockFollowUp());
      prisma.quoteFollowUp.update.mockResolvedValue(mockFollowUp());

      await service.update(COMPANY_ID, FOLLOW_UP_ID, { notes: 'Só nota' });

      expect(prisma.quoteFollowUp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ type: expect.anything() }),
        }),
      );
    });

    it('lança NotFoundException quando o follow-up não existe', async () => {
      prisma.quoteFollowUp.findFirst.mockResolvedValue(null);

      await expect(
        service.update(COMPANY_ID, 'inexistente', { notes: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException para follow-up de outra empresa (tenant isolation)', async () => {
      prisma.quoteFollowUp.findFirst.mockResolvedValue(null);

      await expect(
        service.update(OTHER_COMPANY_ID, FOLLOW_UP_ID, { notes: 'x' }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.quoteFollowUp.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: FOLLOW_UP_ID,
            companyId: OTHER_COMPANY_ID,
          }),
        }),
      );
    });
  });

  // ── updateStatus ─────────────────────────────────────────

  describe('updateStatus', () => {
    it('PENDING → DONE: transição válida e registra doneAt', async () => {
      prisma.quoteFollowUp.findFirst.mockResolvedValue(mockFollowUp());
      prisma.quoteFollowUp.update.mockResolvedValue(
        mockFollowUp({ status: 'DONE', doneAt: new Date() }),
      );

      const result = await service.updateStatus(
        COMPANY_ID,
        FOLLOW_UP_ID,
        QuoteFollowUpStatus.DONE,
      );

      expect(result.status).toBe('DONE');
      expect(prisma.quoteFollowUp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DONE',
            doneAt: expect.any(Date),
          }),
        }),
      );
    });

    it('PENDING → CANCELLED: transição válida sem doneAt', async () => {
      prisma.quoteFollowUp.findFirst.mockResolvedValue(mockFollowUp());
      prisma.quoteFollowUp.update.mockResolvedValue(
        mockFollowUp({ status: 'CANCELLED' }),
      );

      const result = await service.updateStatus(
        COMPANY_ID,
        FOLLOW_UP_ID,
        QuoteFollowUpStatus.CANCELLED,
      );

      expect(result.status).toBe('CANCELLED');
      expect(prisma.quoteFollowUp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ doneAt: expect.anything() }),
        }),
      );
    });

    it('DONE → PENDING: transição INVÁLIDA (estado terminal)', async () => {
      prisma.quoteFollowUp.findFirst.mockResolvedValue(
        mockFollowUp({ status: 'DONE' }),
      );

      await expect(
        service.updateStatus(
          COMPANY_ID,
          FOLLOW_UP_ID,
          QuoteFollowUpStatus.PENDING,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('CANCELLED → DONE: transição INVÁLIDA (estado terminal)', async () => {
      prisma.quoteFollowUp.findFirst.mockResolvedValue(
        mockFollowUp({ status: 'CANCELLED' }),
      );

      await expect(
        service.updateStatus(
          COMPANY_ID,
          FOLLOW_UP_ID,
          QuoteFollowUpStatus.DONE,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança NotFoundException quando o follow-up não existe', async () => {
      prisma.quoteFollowUp.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          COMPANY_ID,
          'inexistente',
          QuoteFollowUpStatus.DONE,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── listToday ────────────────────────────────────────────

  describe('listToday', () => {
    it('retorna apenas follow-ups PENDING agendados até o fim do dia', async () => {
      prisma.quoteFollowUp.findMany.mockResolvedValue([mockFollowUp()]);

      const result = await service.listToday(COMPANY_ID);

      expect(prisma.quoteFollowUp.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: COMPANY_ID,
            deletedAt: null,
            status: QuoteFollowUpStatus.PENDING,
            scheduledAt: { lte: expect.any(Date) },
          }),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('filtra por companyId — follow-ups de outra empresa não aparecem', async () => {
      prisma.quoteFollowUp.findMany.mockResolvedValue([]);

      const result = await service.listToday(OTHER_COMPANY_ID);

      expect(prisma.quoteFollowUp.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: OTHER_COMPANY_ID,
            status: QuoteFollowUpStatus.PENDING,
          }),
        }),
      );
      expect(result).toHaveLength(0);
    });

    it('não inclui follow-ups DONE na agenda do dia', async () => {
      prisma.quoteFollowUp.findMany.mockResolvedValue([]);

      await service.listToday(COMPANY_ID);

      const call = prisma.quoteFollowUp.findMany.mock.calls[0][0];
      expect(call.where.status).toBe(QuoteFollowUpStatus.PENDING);
    });
  });
});
