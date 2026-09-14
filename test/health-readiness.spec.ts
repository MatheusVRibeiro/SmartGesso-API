import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../src/modules/health/health.controller';

/**
 * Testes unitários do readiness probe (ETAPA 15).
 * Mock do PrismaService — nenhuma conexão real com banco.
 */
describe('HealthController.readiness', () => {
  let controller: HealthController;
  const prisma = {
    $queryRaw: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new HealthController(prisma as any);
  });

  it('banco responde → 200 com status ok e database up', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.readiness();

    expect(result).toEqual({ status: 'ok', database: 'up' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('banco lança erro → ServiceUnavailableException (503) com database down', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

    await expect(controller.readiness()).rejects.toThrow(
      ServiceUnavailableException,
    );
    try {
      await controller.readiness();
    } catch (e) {
      const httpEx = e as ServiceUnavailableException;
      expect(httpEx.getStatus()).toBe(503);
      expect(httpEx.getResponse()).toEqual({
        status: 'error',
        database: 'down',
      });
    }
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('não expõe detalhes do erro original na resposta', async () => {
    prisma.$queryRaw.mockRejectedValue(
      new Error('P1001: postgres://user:secret@host/db unreachable'),
    );

    try {
      await controller.readiness();
      throw new Error('deveria ter lançado');
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceUnavailableException);
      const body = JSON.stringify((e as ServiceUnavailableException).getResponse());
      expect(body).not.toContain('secret');
      expect(body).not.toContain('P1001');
      expect(body).not.toContain('unreachable');
    }
  });

  it('liveness /health permanece barato e intocado (sem tocar no banco)', () => {
    const result = controller.health();
    expect(result).toEqual({ status: 'ok', app: 'SmartGesso API' });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
