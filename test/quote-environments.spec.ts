import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuoteEnvironmentsService } from '../src/modules/quote-environments/quote-environments.service';

/**
 * Testes de tenant isolation e compatibilidade para QuoteEnvironment (ETAPA 6b V4).
 * PrismaService é mockado — nenhum banco é acessado.
 *
 * Regras validadas:
 * - cria ambiente no quote do tenant autenticado;
 * - impede ambiente em quote de OUTRO tenant (400 BadRequest);
 * - medição funciona sem Work (workId não enviado);
 * - dados legados (workId) continuam consultáveis via findMeasurementsByQuote;
 * - CRUD completo de environments respeita isolamento por companyId.
 */
describe('QuoteEnvironmentsService (ETAPA 6b V4)', () => {
  let service: QuoteEnvironmentsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      quote: { findFirst: jest.fn() },
      quoteEnvironment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      measurement: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new QuoteEnvironmentsService(prisma);
  });

  // ──────────────────────────────────────────────────────────────
  // createEnvironment
  // ──────────────────────────────────────────────────────────────
  describe('createEnvironment', () => {
    it('cria ambiente no quote correto (tenant autenticado)', async () => {
      prisma.quote.findFirst.mockResolvedValue({ id: 'quote-1' });
      prisma.quoteEnvironment.aggregate.mockResolvedValue({
        _max: { order: 0 },
      });
      prisma.quoteEnvironment.create.mockResolvedValue({
        id: 'env-1',
        companyId: 'company-1',
        quoteId: 'quote-1',
        name: 'Sala de Estar',
        description: 'Ambiente principal',
        order: 1,
        measurements: [],
      });

      const result = await service.createEnvironment('company-1', 'quote-1', {
        name: 'Sala de Estar',
        description: 'Ambiente principal',
      });

      // Valida que o quote pertence à empresa autenticada
      expect(prisma.quote.findFirst).toHaveBeenCalledWith({
        where: { id: 'quote-1', companyId: 'company-1', deletedAt: null },
        select: { id: true },
      });

      // Cria com companyId e quoteId corretos
      expect(prisma.quoteEnvironment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'company-1',
          quoteId: 'quote-1',
          name: 'Sala de Estar',
          description: 'Ambiente principal',
          order: 1,
        }),
        include: expect.any(Object),
      });

      expect(result.id).toBe('env-1');
      expect(result.name).toBe('Sala de Estar');
    });

    it('impede ambiente em quote de OUTRO tenant (400 BadRequest)', async () => {
      // quote-2 pertence à company-2; company-1 não encontra o quote
      prisma.quote.findFirst.mockResolvedValue(null);

      await expect(
        service.createEnvironment('company-1', 'quote-2', {
          name: 'Ambiente',
        }),
      ).rejects.toThrow(BadRequestException);

      // Garante que NÃO criou nada
      expect(prisma.quoteEnvironment.create).not.toHaveBeenCalled();
    });

    it('usa companyId do contexto autenticado, nunca do body', async () => {
      prisma.quote.findFirst.mockResolvedValue({ id: 'quote-1' });
      prisma.quoteEnvironment.aggregate.mockResolvedValue({
        _max: { order: 0 },
      });
      prisma.quoteEnvironment.create.mockResolvedValue({
        id: 'env-1',
        companyId: 'company-1',
        quoteId: 'quote-1',
        name: 'Sala',
        order: 1,
        measurements: [],
      });

      await service.createEnvironment('company-1', 'quote-1', {
        name: 'Sala',
      });

      const createData = prisma.quoteEnvironment.create.mock.calls[0][0].data;
      expect(createData.companyId).toBe('company-1');
    });

    it('calcula order automaticamente quando não informado', async () => {
      prisma.quote.findFirst.mockResolvedValue({ id: 'quote-1' });
      prisma.quoteEnvironment.aggregate.mockResolvedValue({
        _max: { order: 3 },
      });
      prisma.quoteEnvironment.create.mockResolvedValue({
        id: 'env-1',
        order: 4,
        measurements: [],
      });

      await service.createEnvironment('company-1', 'quote-1', {
        name: 'Ambiente',
      });

      const createData = prisma.quoteEnvironment.create.mock.calls[0][0].data;
      expect(createData.order).toBe(4);
    });

    it('usa order informado no dto quando presente', async () => {
      prisma.quote.findFirst.mockResolvedValue({ id: 'quote-1' });
      prisma.quoteEnvironment.create.mockResolvedValue({
        id: 'env-1',
        order: 10,
        measurements: [],
      });

      await service.createEnvironment('company-1', 'quote-1', {
        name: 'Ambiente',
        order: 10,
      });

      const createData = prisma.quoteEnvironment.create.mock.calls[0][0].data;
      expect(createData.order).toBe(10);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // findEnvironments
  // ──────────────────────────────────────────────────────────────
  describe('findEnvironments', () => {
    it('lista ambientes do quote do tenant autenticado', async () => {
      prisma.quote.findFirst.mockResolvedValue({ id: 'quote-1' });
      prisma.quoteEnvironment.findMany.mockResolvedValue([
        { id: 'env-1', name: 'Sala', order: 0, measurements: [] },
        { id: 'env-2', name: 'Cozinha', order: 1, measurements: [] },
      ]);

      const result = await service.findEnvironments('company-1', 'quote-1');

      expect(prisma.quoteEnvironment.findMany).toHaveBeenCalledWith({
        where: { companyId: 'company-1', quoteId: 'quote-1', deletedAt: null },
        include: expect.any(Object),
        orderBy: { order: 'asc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Sala');
      expect(result[1].name).toBe('Cozinha');
    });

    it('impede listagem de ambientes de quote de OUTRO tenant', async () => {
      prisma.quote.findFirst.mockResolvedValue(null);

      await expect(
        service.findEnvironments('company-1', 'quote-2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('não retorna ambientes excluídos (soft delete)', async () => {
      prisma.quote.findFirst.mockResolvedValue({ id: 'quote-1' });
      prisma.quoteEnvironment.findMany.mockResolvedValue([
        { id: 'env-1', name: 'Sala', order: 0, measurements: [] },
      ]);

      await service.findEnvironments('company-1', 'quote-1');

      expect(prisma.quoteEnvironment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────
  // updateEnvironment
  // ──────────────────────────────────────────────────────────────
  describe('updateEnvironment', () => {
    it('atualiza ambiente do tenant autenticado', async () => {
      prisma.quoteEnvironment.findFirst.mockResolvedValue({ id: 'env-1' });
      prisma.quoteEnvironment.update.mockResolvedValue({
        id: 'env-1',
        companyId: 'company-1',
        quoteId: 'quote-1',
        name: 'Sala Atualizada',
        description: 'Nova descrição',
        order: 2,
        measurements: [],
      });

      const result = await service.updateEnvironment(
        'company-1',
        'quote-1',
        'env-1',
        { name: 'Sala Atualizada', description: 'Nova descrição', order: 2 },
      );

      expect(prisma.quoteEnvironment.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'env-1',
          companyId: 'company-1',
          quoteId: 'quote-1',
          deletedAt: null,
        },
        select: { id: true },
      });
      expect(prisma.quoteEnvironment.update).toHaveBeenCalledWith({
        where: { id: 'env-1' },
        data: expect.objectContaining({
          name: 'Sala Atualizada',
          description: 'Nova descrição',
          order: 2,
        }),
        include: expect.any(Object),
      });
      expect(result.name).toBe('Sala Atualizada');
    });

    it('lança NotFoundException para ambiente de OUTRO tenant', async () => {
      // env-2 pertence à company-2; company-1 não encontra
      prisma.quoteEnvironment.findFirst.mockResolvedValue(null);

      await expect(
        service.updateEnvironment('company-1', 'quote-1', 'env-2', {
          name: 'Teste',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.quoteEnvironment.update).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // removeEnvironment
  // ──────────────────────────────────────────────────────────────
  describe('removeEnvironment', () => {
    it('remove (soft delete) ambiente do tenant autenticado', async () => {
      prisma.quoteEnvironment.findFirst.mockResolvedValue({ id: 'env-1' });
      prisma.quoteEnvironment.update.mockResolvedValue({
        id: 'env-1',
        deletedAt: new Date(),
      });

      const result = await service.removeEnvironment(
        'company-1',
        'quote-1',
        'env-1',
      );

      expect(prisma.quoteEnvironment.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'env-1',
          companyId: 'company-1',
          quoteId: 'quote-1',
          deletedAt: null,
        },
        select: { id: true },
      });
      expect(prisma.quoteEnvironment.update).toHaveBeenCalledWith({
        where: { id: 'env-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result.deleted).toBe(true);
      expect(result.id).toBe('env-1');
    });

    it('lança NotFoundException para ambiente de OUTRO tenant', async () => {
      prisma.quoteEnvironment.findFirst.mockResolvedValue(null);

      await expect(
        service.removeEnvironment('company-1', 'quote-1', 'env-2'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.quoteEnvironment.update).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // createMeasurement — medição sem Work
  // ──────────────────────────────────────────────────────────────
  describe('createMeasurement (sem Work)', () => {
    it('cria medição sem workId — workId não é enviado (null no schema)', async () => {
      prisma.quoteEnvironment.findFirst.mockResolvedValue({
        id: 'env-1',
        quoteId: 'quote-1',
      });
      prisma.measurement.create.mockResolvedValue({
        id: 'meas-1',
        companyId: 'company-1',
        quoteEnvironmentId: 'env-1',
        workId: null,
        environmentName: 'Sala',
        applicationType: 'DRYWALL',
        length: 5,
        width: 4,
        ceilingHeight: 2.8,
        area: 20,
        perimeter: 18,
        doors: 2,
        windows: 1,
        cutouts: 0,
        fixtures: 0,
        hasCove: false,
        hasDropCeiling: false,
        observations: null,
      });

      const result = await service.createMeasurement(
        'company-1',
        'quote-1',
        'env-1',
        {
          environmentName: 'Sala',
          applicationType: 'DRYWALL',
          length: 5,
          width: 4,
          ceilingHeight: 2.8,
          doors: 2,
          windows: 1,
        },
      );

      const createData = prisma.measurement.create.mock.calls[0][0].data;

      // workId NÃO é enviado — medição funciona sem Work
      expect(createData.workId).toBeUndefined();
      expect(createData.quoteEnvironmentId).toBe('env-1');
      expect(createData.companyId).toBe('company-1');
      expect(result.workId).toBeNull();
    });

    it('impede medição em ambiente de OUTRO tenant', async () => {
      prisma.quoteEnvironment.findFirst.mockResolvedValue(null);

      await expect(
        service.createMeasurement('company-1', 'quote-1', 'env-2', {
          environmentName: 'Sala',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.measurement.create).not.toHaveBeenCalled();
    });

    it('calcula área e perímetro automaticamente a partir de length × width', async () => {
      prisma.quoteEnvironment.findFirst.mockResolvedValue({
        id: 'env-1',
        quoteId: 'quote-1',
      });
      prisma.measurement.create.mockResolvedValue({
        id: 'meas-1',
        area: 20,
        perimeter: 18,
      });

      await service.createMeasurement('company-1', 'quote-1', 'env-1', {
        environmentName: 'Sala',
        applicationType: 'DRYWALL',
        length: 5,
        width: 4,
      });

      const createData = prisma.measurement.create.mock.calls[0][0].data;
      expect(createData.area).toBe(20); // 5 × 4
      expect(createData.perimeter).toBe(18); // 2 × (5 + 4)
    });

    it('usa area/perimeter enviados como fallback quando length/width ausentes', async () => {
      prisma.quoteEnvironment.findFirst.mockResolvedValue({
        id: 'env-1',
        quoteId: 'quote-1',
      });
      prisma.measurement.create.mockResolvedValue({
        id: 'meas-1',
        area: 30,
        perimeter: 22,
      });

      await service.createMeasurement('company-1', 'quote-1', 'env-1', {
        environmentName: 'Sala',
        applicationType: 'DRYWALL',
        area: 30,
        perimeter: 22,
      });

      const createData = prisma.measurement.create.mock.calls[0][0].data;
      expect(createData.area).toBe(30);
      expect(createData.perimeter).toBe(22);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // findMeasurementsByQuote — compatibilidade legada
  // ──────────────────────────────────────────────────────────────
  describe('findMeasurementsByQuote (compatibilidade legada)', () => {
    it('dados legados (workId) continuam consultáveis', async () => {
      prisma.quote.findFirst.mockResolvedValue({ id: 'quote-1' });
      prisma.quoteEnvironment.findMany.mockResolvedValue([
        {
          id: 'env-1',
          name: 'Sala',
          order: 0,
          measurements: [
            {
              id: 'meas-1',
              companyId: 'company-1',
              quoteEnvironmentId: 'env-1',
              workId: 'work-1', // legacy workId ainda presente
              environmentName: 'Sala',
              applicationType: 'DRYWALL',
              length: 5,
              width: 4,
              ceilingHeight: 2.8,
              area: 20,
              perimeter: 18,
              doors: 2,
              windows: 1,
              cutouts: 0,
              fixtures: 0,
              hasCove: false,
              hasDropCeiling: false,
              observations: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
            },
          ],
        },
      ]);

      const result = await service.findMeasurementsByQuote(
        'company-1',
        'quote-1',
      );

      expect(result).toHaveLength(1);
      // workId legado é preservado na resposta
      expect(result[0].workId).toBe('work-1');
      expect(result[0].environmentId).toBe('env-1');
      expect(result[0].environmentName).toBe('Sala');
    });

    it('encontra medições sem workId (novo fluxo sem Work)', async () => {
      prisma.quote.findFirst.mockResolvedValue({ id: 'quote-1' });
      prisma.quoteEnvironment.findMany.mockResolvedValue([
        {
          id: 'env-1',
          name: 'Sala',
          order: 0,
          measurements: [
            {
              id: 'meas-1',
              companyId: 'company-1',
              quoteEnvironmentId: 'env-1',
              workId: null, // sem workId — novo fluxo
              environmentName: 'Sala',
              applicationType: 'DRYWALL',
              length: 5,
              width: 4,
              area: 20,
              perimeter: 18,
              doors: 0,
              windows: 0,
              cutouts: 0,
              fixtures: 0,
              hasCove: false,
              hasDropCeiling: false,
              observations: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
            },
          ],
        },
      ]);

      const result = await service.findMeasurementsByQuote(
        'company-1',
        'quote-1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].workId).toBeNull();
      expect(result[0].environmentId).toBe('env-1');
    });

    it('impede consulta de medições de quote de OUTRO tenant', async () => {
      prisma.quote.findFirst.mockResolvedValue(null);

      await expect(
        service.findMeasurementsByQuote('company-1', 'quote-2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('retorna medições de todos os ambientes do quote, ordenadas', async () => {
      prisma.quote.findFirst.mockResolvedValue({ id: 'quote-1' });
      prisma.quoteEnvironment.findMany.mockResolvedValue([
        {
          id: 'env-1',
          name: 'Sala',
          order: 0,
          measurements: [
            {
              id: 'meas-1',
              companyId: 'company-1',
              quoteEnvironmentId: 'env-1',
              workId: null,
              environmentName: 'Sala',
              applicationType: 'DRYWALL',
              length: 5,
              width: 4,
              area: 20,
              perimeter: 18,
              doors: 0,
              windows: 0,
              cutouts: 0,
              fixtures: 0,
              hasCove: false,
              hasDropCeiling: false,
              observations: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
            },
          ],
        },
        {
          id: 'env-2',
          name: 'Cozinha',
          order: 1,
          measurements: [
            {
              id: 'meas-2',
              companyId: 'company-1',
              quoteEnvironmentId: 'env-2',
              workId: null,
              environmentName: 'Cozinha',
              applicationType: 'FORRO',
              length: 3,
              width: 2,
              area: 6,
              perimeter: 10,
              doors: 0,
              windows: 0,
              cutouts: 0,
              fixtures: 0,
              hasCove: false,
              hasDropCeiling: false,
              observations: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
            },
          ],
        },
      ]);

      const result = await service.findMeasurementsByQuote(
        'company-1',
        'quote-1',
      );

      expect(result).toHaveLength(2);
      expect(result[0].environmentId).toBe('env-1');
      expect(result[1].environmentId).toBe('env-2');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // updateMeasurement
  // ──────────────────────────────────────────────────────────────
  describe('updateMeasurement', () => {
    it('atualiza medição do tenant autenticado', async () => {
      // 1º findFirst: validação de propriedade
      prisma.measurement.findFirst.mockResolvedValueOnce({ id: 'meas-1' });
      // 2º findFirst: busca dados existentes para recalcular
      prisma.measurement.findFirst.mockResolvedValueOnce({
        id: 'meas-1',
        length: 5,
        width: 4,
        area: 20,
        perimeter: 18,
      });
      prisma.measurement.update.mockResolvedValue({
        id: 'meas-1',
        environmentName: 'Sala Atualizada',
        length: 6,
        width: 5,
        area: 30,
        perimeter: 22,
      });

      const result = await service.updateMeasurement(
        'company-1',
        'quote-1',
        'env-1',
        'meas-1',
        { environmentName: 'Sala Atualizada', length: 6, width: 5 },
      );

      expect(prisma.measurement.update).toHaveBeenCalledWith({
        where: { id: 'meas-1' },
        data: expect.objectContaining({
          environmentName: 'Sala Atualizada',
          length: 6,
          width: 5,
          area: 30,
          perimeter: 22,
        }),
      });
      expect(result.environmentName).toBe('Sala Atualizada');
    });

    it('lança NotFoundException para medição de OUTRO tenant', async () => {
      prisma.measurement.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMeasurement(
          'company-1',
          'quote-1',
          'env-1',
          'meas-2',
          { environmentName: 'Teste' },
        ),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.measurement.update).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // CRUD resumido — garante que todos os métodos respeitam tenant
  // ──────────────────────────────────────────────────────────────
  describe('CRUD de environments (tenant isolation)', () => {
    it('createEnvironment: companyId vem do contexto, não do body', async () => {
      prisma.quote.findFirst.mockResolvedValue({ id: 'quote-1' });
      prisma.quoteEnvironment.aggregate.mockResolvedValue({
        _max: { order: 0 },
      });
      prisma.quoteEnvironment.create.mockResolvedValue({
        id: 'env-1',
        companyId: 'company-1',
        quoteId: 'quote-1',
        name: 'Sala',
        order: 1,
        measurements: [],
      });

      await service.createEnvironment('company-1', 'quote-1', {
        name: 'Sala',
      });

      const data = prisma.quoteEnvironment.create.mock.calls[0][0].data;
      expect(data.companyId).toBe('company-1');
      expect(data.quoteId).toBe('quote-1');
    });

    it('findEnvironments: filtra por companyId', async () => {
      prisma.quote.findFirst.mockResolvedValue({ id: 'quote-1' });
      prisma.quoteEnvironment.findMany.mockResolvedValue([]);

      await service.findEnvironments('company-1', 'quote-1');

      expect(prisma.quoteEnvironment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-1' }),
        }),
      );
    });

    it('updateEnvironment: valida ownership antes de atualizar', async () => {
      prisma.quoteEnvironment.findFirst.mockResolvedValue(null);

      await expect(
        service.updateEnvironment('company-1', 'quote-1', 'env-2', {
          name: 'X',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('removeEnvironment: valida ownership antes de remover', async () => {
      prisma.quoteEnvironment.findFirst.mockResolvedValue(null);

      await expect(
        service.removeEnvironment('company-1', 'quote-1', 'env-2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('createEnvironment: gera nome padrão se name estiver vazio ou ausente', async () => {
      prisma.quote.findFirst.mockResolvedValue({ id: 'quote-1' });
      prisma.quoteEnvironment.aggregate.mockResolvedValue({
        _max: { order: 0 },
      });
      prisma.quoteEnvironment.create.mockResolvedValue({
        id: 'env-default',
        companyId: 'company-1',
        quoteId: 'quote-1',
        name: 'Ambiente 1',
        order: 1,
        measurements: [],
      });

      const result = await service.createEnvironment('company-1', 'quote-1', {
        name: '',
      });

      expect(prisma.quoteEnvironment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Ambiente 1',
            order: 1,
          }),
        }),
      );
      expect(result.name).toBe('Ambiente 1');
    });

    it('createMeasurement: aceita height como alias para ceilingHeight e busca nome do ambiente pai se ausente', async () => {
      prisma.quoteEnvironment.findFirst
        .mockResolvedValueOnce({ id: 'env-1' }) // ensureEnvironmentBelongsToCompany
        .mockResolvedValueOnce({ name: 'Sala de Estar' }); // fetch env name fallback

      prisma.measurement.create.mockResolvedValue({
        id: 'meas-height',
        companyId: 'company-1',
        quoteEnvironmentId: 'env-1',
        environmentName: 'Sala de Estar',
        ceilingHeight: 2.8,
        length: 5,
        width: 4,
        area: 20,
        perimeter: 18,
      });

      const result = await service.createMeasurement(
        'company-1',
        'quote-1',
        'env-1',
        {
          height: 2.8,
          length: 5,
          width: 4,
        },
      );

      expect(prisma.measurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            environmentName: 'Sala de Estar',
            ceilingHeight: 2.8,
          }),
        }),
      );
      expect(result.ceilingHeight).toBe(2.8);
      expect(result.environmentName).toBe('Sala de Estar');
    });
  });
});
