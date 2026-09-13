import { GoneException, NotFoundException } from '@nestjs/common';
import { QuotesService } from '../src/modules/quotes/quotes.service';

describe('QuotesService.findByCompanyToken (P0 auditoria)', () => {
  let service: QuotesService;
  const prisma = {
    quote: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QuotesService(
      prisma as any,
      { increment: jest.fn().mockResolvedValue({ currentValue: 1 }) } as any,
      { log: jest.fn() } as any,
      { create: jest.fn().mockResolvedValue({}) } as any,
      { sendToCompany: jest.fn().mockResolvedValue({ sent: 0 }) } as any,
    );
  });

  it('retorna o orçamento quando o token pertence à empresa', async () => {
    const mockQuote = {
      id: 'q1',
      companyId: 'company-1',
      publicToken: 'token-abc',
      validUntil: new Date(Date.now() + 86400000),
      client: { id: 'c1', name: 'Cliente' },
      items: [],
    };
    prisma.quote.findFirst.mockResolvedValue(mockQuote);

    const result = await service.findByCompanyToken('company-1', 'token-abc');
    expect(result).toBe(mockQuote);
    expect(prisma.quote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-1', publicToken: 'token-abc' }),
      }),
    );
  });

  it('lança 404 para token de outra empresa (tenant isolation)', async () => {
    prisma.quote.findFirst.mockResolvedValue(null);
    await expect(service.findByCompanyToken('company-1', 'token-outra')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lança 404 para token inexistente', async () => {
    prisma.quote.findFirst.mockResolvedValue(null);
    await expect(service.findByCompanyToken('company-1', 'token-xyz')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lança 410 Gone quando o link expirou', async () => {
    const expiredQuote = {
      id: 'q1',
      companyId: 'company-1',
      publicToken: 'token-expired',
      validUntil: new Date(Date.now() - 3600000),
      client: { id: 'c1', name: 'Cliente' },
      items: [],
    };
    prisma.quote.findFirst.mockResolvedValue(expiredQuote);

    await expect(service.findByCompanyToken('company-1', 'token-expired')).rejects.toThrow(
      GoneException,
    );
  });
});
