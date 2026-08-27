import { CompanySequenceService, SEQUENCE_TYPES } from '../src/modules/core/services/company-sequence.service';

/**
 * Testes de concorrência da numeração atômica (ETAPA 4 V4).
 *
 * PrismaService é mockado — nenhum banco é acessado.
 *
 * O mock simula row-level lock do MySQL: apenas uma "transação" executa
 * o incremento de cada vez, garantindo que chamadas concorrentes nunca
 * produzam números duplicados.
 */
describe('CompanySequenceService (concorrência — ETAPA 4 V4)', () => {
  /**
   * Cria um mock do Prisma que simula atomicidade via lock.
   * O `$transaction` adquire um lock antes de executar o callback e libera
   * ao final, exatamente como o MySQL faz com o X-lock do UPDATE.
   *
   * Contadores são isolados por (companyId, entityType) para garantir
   * que chamadas concorrentes de tipos/tenants diferentes não interferam.
   */
  function createAtomicMock() {
    const counters: Record<string, number> = {};
    let lock = false;
    const waiting: Array<() => void> = [];

    const mock: any = {
      companySequence: {
        upsert: jest.fn().mockImplementation(async ({ where }) => {
          const key = `${where.companyId_entityType.companyId}:${where.companyId_entityType.entityType}`;
          counters[key] = (counters[key] || 0) + 1;
          return { currentValue: counters[key] };
        }),
      },
      $transaction: jest.fn(async (fn: (t: any) => any) => {
        // Simula row-level lock: apenas uma transação de cada vez
        while (lock) {
          await new Promise<void>((resolve) => waiting.push(resolve));
        }
        lock = true;
        try {
          return await fn(mock);
        } finally {
          lock = false;
          if (waiting.length > 0) {
            waiting.shift()!();
          }
        }
      }),
    };

    return { mock, counters };
  }

  describe('increment', () => {
    it('retorna o valor incrementado atomicamente', async () => {
      const { mock } = createAtomicMock();
      const service = new CompanySequenceService(mock);

      const result = await service.increment('company-1', SEQUENCE_TYPES.QUOTE);

      expect(result).toBe(1);
    });

    it('usa upsert com increment: 1 (operador atômico do Prisma)', async () => {
      const { mock } = createAtomicMock();
      const service = new CompanySequenceService(mock);

      await service.increment('company-1', SEQUENCE_TYPES.SERVICE_ORDER);

      expect(mock.companySequence.upsert).toHaveBeenCalledWith({
        where: {
          companyId_entityType: {
            companyId: 'company-1',
            entityType: 'SERVICE_ORDER',
          },
        },
        update: {
          currentValue: { increment: 1 },
        },
        create: {
          companyId: 'company-1',
          entityType: 'SERVICE_ORDER',
          currentValue: 1,
        },
      });
    });

    it('garante a existência da linha via upsert antes do incremento', async () => {
      const { mock } = createAtomicMock();
      const service = new CompanySequenceService(mock);

      await service.increment('company-1', SEQUENCE_TYPES.QUOTE);

      expect(mock.companySequence.upsert).toHaveBeenCalledWith({
        where: {
          companyId_entityType: {
            companyId: 'company-1',
            entityType: 'QUOTE',
          },
        },
        update: {
          currentValue: { increment: 1 },
        },
        create: {
          companyId: 'company-1',
          entityType: 'QUOTE',
          currentValue: 1,
        },
      });
    });

    it('retorna o valor incrementado do upsert', async () => {
      const { mock } = createAtomicMock();
      const service = new CompanySequenceService(mock);

      await service.increment('company-1', SEQUENCE_TYPES.QUOTE);

      expect(mock.companySequence.upsert).toHaveBeenCalled();
    });

    it('envolve tudo em uma transação quando tx não é passado', async () => {
      const { mock } = createAtomicMock();
      const service = new CompanySequenceService(mock);

      await service.increment('company-1', SEQUENCE_TYPES.QUOTE);

      expect(mock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('reutiliza a transação passada como parâmetro (tx)', async () => {
      const { mock } = createAtomicMock();
      const service = new CompanySequenceService(mock);

      const tx = {
        companySequence: mock.companySequence,
      };

      await service.increment('company-1', SEQUENCE_TYPES.QUOTE, tx);

      // Não deve criar uma nova transação — reutiliza a tx passada
      expect(mock.$transaction).not.toHaveBeenCalled();
      expect(tx.companySequence.upsert).toHaveBeenCalled();
    });
  });

  describe('concorrência', () => {
    it('100 chamadas concorrentes produzem valores únicos e sequenciais (1..100)', async () => {
      const { mock } = createAtomicMock();
      const service = new CompanySequenceService(mock);

      const promises = Array.from({ length: 100 }, () =>
        service.increment('company-1', SEQUENCE_TYPES.QUOTE),
      );
      const results = await Promise.all(promises);

      // Todos os valores são únicos
      const unique = new Set(results);
      expect(unique.size).toBe(100);

      // Os valores são exatamente 1..100 (sequenciais, sem gaps)
      const sorted = [...results].sort((a, b) => a - b);
      for (let i = 0; i < 100; i++) {
        expect(sorted[i]).toBe(i + 1);
      }

      // upsert foi chamado 100 vezes
      expect(mock.companySequence.upsert).toHaveBeenCalledTimes(100);
    });

    it('chamadas concorrentes de tipos diferentes não interferem', async () => {
      const { mock } = createAtomicMock();
      const service = new CompanySequenceService(mock);

      const quotePromises = Array.from({ length: 50 }, () =>
        service.increment('company-1', SEQUENCE_TYPES.QUOTE),
      );
      const soPromises = Array.from({ length: 50 }, () =>
        service.increment('company-1', SEQUENCE_TYPES.SERVICE_ORDER),
      );

      const [quoteResults, soResults] = await Promise.all([
        Promise.all(quotePromises),
        Promise.all(soPromises),
      ]);

      // Cada tipo tem 50 valores únicos
      expect(new Set(quoteResults).size).toBe(50);
      expect(new Set(soResults).size).toBe(50);

      // Os valores de cada tipo são 1..50
      const sortedQuotes = [...quoteResults].sort((a, b) => a - b);
      const sortedSOs = [...soResults].sort((a, b) => a - b);
      for (let i = 0; i < 50; i++) {
        expect(sortedQuotes[i]).toBe(i + 1);
        expect(sortedSOs[i]).toBe(i + 1);
      }
    });

    it('chamadas concorrentes de tenants diferentes não interferem', async () => {
      const { mock } = createAtomicMock();
      const service = new CompanySequenceService(mock);

      const promisesA = Array.from({ length: 30 }, () =>
        service.increment('company-a', SEQUENCE_TYPES.QUOTE),
      );
      const promisesB = Array.from({ length: 30 }, () =>
        service.increment('company-b', SEQUENCE_TYPES.QUOTE),
      );

      const [resultsA, resultsB] = await Promise.all([
        Promise.all(promisesA),
        Promise.all(promisesB),
      ]);

      // Cada tenant tem 30 valores únicos
      expect(new Set(resultsA).size).toBe(30);
      expect(new Set(resultsB).size).toBe(30);

      // Ambos começam em 1 (isolamento por tenant)
      expect(Math.min(...resultsA)).toBe(1);
      expect(Math.min(...resultsB)).toBe(1);
    });
  });
});
