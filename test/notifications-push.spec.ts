import { PushService } from '../src/modules/notifications/push.service';

/**
 * Testes unitários do PushService (push notifications via Expo).
 *
 * O expo-server-sdk v6 é ESM-only; o jest.config.js mapeia o pacote para
 * test/mocks/expo-server-sdk.ts. Aqui usamos jest.mock com factory para
 * controlar os tickets retornados por sendPushNotificationsAsync.
 */

const mockSendPush = jest.fn();

jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({
    sendPushNotificationsAsync: (...args: any[]) => mockSendPush(...args),
  })),
}));

describe('PushService.sendToCompany', () => {
  let service: PushService;
  let prisma: any;

  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    // Força o caminho real (fora do short-circuit de NODE_ENV=test)
    process.env.NODE_ENV = 'development';
    prisma = {
      pushToken: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    service = new PushService(prisma as any);
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('envia push para todos os tokens ativos da empresa', async () => {
    prisma.pushToken.findMany.mockResolvedValue([
      { id: 'token-1', token: 'ExponentPushToken[abc]' },
      { id: 'token-2', token: 'ExponentPushToken[def]' },
    ]);
    mockSendPush.mockResolvedValue([
      { status: 'ok', id: 'receipt-1' },
      { status: 'ok', id: 'receipt-2' },
    ]);

    const result = await service.sendToCompany('company-1', {
      title: 'Orçamento aprovado',
      body: 'Orçamento #42 aprovado — Serviço criado',
      data: { route: '/servicos/os-1' },
    });

    // Busca apenas tokens ativos (deletedAt: null) da empresa
    expect(prisma.pushToken.findMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1', deletedAt: null },
      select: { id: true, token: true },
    });

    // Uma mensagem ExpoPushMessage por token
    expect(mockSendPush).toHaveBeenCalledTimes(1);
    const messages = mockSendPush.mock.calls[0][0];
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({
      to: 'ExponentPushToken[abc]',
      title: 'Orçamento aprovado',
      body: 'Orçamento #42 aprovado — Serviço criado',
      data: { route: '/servicos/os-1' },
    });
    expect(messages[1].to).toBe('ExponentPushToken[def]');

    expect(result).toEqual({ sent: 2, failed: 0 });
    expect(prisma.pushToken.update).not.toHaveBeenCalled();
  });

  it('ignora empresa sem tokens (não chama o Expo)', async () => {
    prisma.pushToken.findMany.mockResolvedValue([]);

    const result = await service.sendToCompany('company-vazia', {
      title: 'Título',
      body: 'Corpo',
    });

    expect(mockSendPush).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, failed: 0 });
  });

  it('soft-delete (deletedAt) do token com DeviceNotRegistered', async () => {
    prisma.pushToken.findMany.mockResolvedValue([
      { id: 'token-1', token: 'ExponentPushToken[valido]' },
      { id: 'token-2', token: 'ExponentPushToken[invalido]' },
    ]);
    mockSendPush.mockResolvedValue([
      { status: 'ok', id: 'receipt-1' },
      {
        status: 'error',
        message: 'Push notification (ExponentPushToken[invalido]) has not registered for push',
        details: { error: 'DeviceNotRegistered' },
      },
    ]);

    const result = await service.sendToCompany('company-1', {
      title: 'Título',
      body: 'Corpo',
    });

    expect(result).toEqual({ sent: 1, failed: 1 });
    expect(prisma.pushToken.update).toHaveBeenCalledTimes(1);
    expect(prisma.pushToken.update).toHaveBeenCalledWith({
      where: { id: 'token-2' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('soft-delete do token com erro 422/ExponentDeviceNotRegistered na mensagem', async () => {
    prisma.pushToken.findMany.mockResolvedValue([
      { id: 'token-9', token: 'ExponentPushToken[antigo]' },
    ]);
    mockSendPush.mockResolvedValue([
      {
        status: 'error',
        message: 'HTTP 422: ExponentDeviceNotRegistered',
        details: {},
      },
    ]);

    const result = await service.sendToCompany('company-1', {
      title: 'Título',
      body: 'Corpo',
    });

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(prisma.pushToken.update).toHaveBeenCalledWith({
      where: { id: 'token-9' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('não remove token em outros erros (ex.: MessageRateExceeded)', async () => {
    prisma.pushToken.findMany.mockResolvedValue([
      { id: 'token-3', token: 'ExponentPushToken[x]' },
    ]);
    mockSendPush.mockResolvedValue([
      {
        status: 'error',
        message: 'Rate limit exceeded',
        details: { error: 'MessageRateExceeded' },
      },
    ]);

    const result = await service.sendToCompany('company-1', {
      title: 'Título',
      body: 'Corpo',
    });

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(prisma.pushToken.update).not.toHaveBeenCalled();
  });

  it('sanitiza title (>100) e body (>500) truncando com reticências', async () => {
    prisma.pushToken.findMany.mockResolvedValue([
      { id: 'token-1', token: 'ExponentPushToken[abc]' },
    ]);
    mockSendPush.mockResolvedValue([{ status: 'ok', id: 'r1' }]);

    const longTitle = 'T'.repeat(150);
    const longBody = 'B'.repeat(600);

    await service.sendToCompany('company-1', {
      title: longTitle,
      body: longBody,
    });

    const message = mockSendPush.mock.calls[0][0][0];
    expect(message.title).toHaveLength(100);
    expect(message.title).toBe(`${'T'.repeat(99)}…`);
    expect(message.body).toHaveLength(500);
    expect(message.body).toBe(`${'B'.repeat(499)}…`);
  });

  it('mantém title/body dentro do limite sem alterar', async () => {
    prisma.pushToken.findMany.mockResolvedValue([
      { id: 'token-1', token: 'ExponentPushToken[abc]' },
    ]);
    mockSendPush.mockResolvedValue([{ status: 'ok', id: 'r1' }]);

    await service.sendToCompany('company-1', {
      title: 'Exato',
      body: 'Corpo ok',
    });

    const message = mockSendPush.mock.calls[0][0][0];
    expect(message.title).toBe('Exato');
    expect(message.body).toBe('Corpo ok');
  });

  it('retorna { sent: 0 } em NODE_ENV=test sem buscar tokens nem chamar o Expo', async () => {
    process.env.NODE_ENV = 'test';

    const result = await service.sendToCompany('company-1', {
      title: 'Título',
      body: 'Corpo',
    });

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(prisma.pushToken.findMany).not.toHaveBeenCalled();
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('não quebra se o Expo falhar (erro de rede/API)', async () => {
    prisma.pushToken.findMany.mockResolvedValue([
      { id: 'token-1', token: 'ExponentPushToken[abc]' },
    ]);
    mockSendPush.mockRejectedValue(new Error('network down'));

    const result = await service.sendToCompany('company-1', {
      title: 'Título',
      body: 'Corpo',
    });

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(prisma.pushToken.update).not.toHaveBeenCalled();
  });
});
