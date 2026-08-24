import { BadRequestException } from '@nestjs/common';
import {
  FEATURE_KEYS,
  DEFAULT_FEATURES,
  isFeatureKey,
  resolveEffectiveFeatures,
} from '../src/modules/core/company-features';
import { CompanyFeaturesService } from '../src/modules/core/services/company-features.service';
import { BusinessService } from '../src/business.service';

/**
 * Testes da ETAPA 13 — Feature flags por empresa.
 *
 * PrismaService é mockado — nenhum banco é acessado.
 *
 * Cobre: resolução pura (plan + overrides), default, override habilita/
 * desabilita, tenant isolation, hasFeature, setOverride (upsert + validação)
 * e delegação via BusinessService.effectiveFeatures.
 */
describe('company-features', () => {
  const COMPANY_ID = 'company-1';
  const OTHER_COMPANY_ID = 'company-2';

  // ── Constants ─────────────────────────────────────────────

  describe('FEATURE_KEYS / DEFAULT_FEATURES', () => {
    it('lista as 8 features canônicas da ETAPA 13', () => {
      expect(FEATURE_KEYS).toEqual([
        'production',
        'inventory',
        'purchases',
        'team',
        'advancedFinance',
        'warranty',
        'pushNotifications',
        'customBranding',
      ]);
    });

    it('DEFAULT_FEATURES habilita todas as features conhecidas', () => {
      FEATURE_KEYS.forEach((key) => {
        expect(DEFAULT_FEATURES[key]).toBe(true);
      });
    });

    it('isFeatureKey reconhece apenas keys conhecidas', () => {
      expect(isFeatureKey('production')).toBe(true);
      expect(isFeatureKey('customBranding')).toBe(true);
      expect(isFeatureKey('unknownFeature')).toBe(false);
    });
  });

  // ── resolveEffectiveFeatures (função pura) ────────────────

  describe('resolveEffectiveFeatures', () => {
    it('usa as features do plano como base', () => {
      const result = resolveEffectiveFeatures(['production', 'inventory'], []);
      expect(result).toEqual(['inventory', 'production']);
    });

    it('retorna todas as FEATURE_KEYS quando o plano não define features (default)', () => {
      expect(resolveEffectiveFeatures([], [])).toEqual([...FEATURE_KEYS].sort());
      expect(resolveEffectiveFeatures(null, [])).toEqual([...FEATURE_KEYS].sort());
      expect(resolveEffectiveFeatures(undefined, [])).toEqual([...FEATURE_KEYS].sort());
    });

    it('filtra keys desconhecidas vindas do plano', () => {
      const result = resolveEffectiveFeatures(['production', 'hack'], []);
      expect(result).toEqual(['production']);
    });

    it('override enabled=false desabilita feature do plano', () => {
      const result = resolveEffectiveFeatures(
        ['production', 'inventory', 'warranty'],
        [{ feature: 'warranty', enabled: false }],
      );
      expect(result).toEqual(['inventory', 'production']);
    });

    it('override enabled=true habilita feature ausente no plano', () => {
      const result = resolveEffectiveFeatures(
        ['production'],
        [{ feature: 'team', enabled: true }],
      );
      expect(result).toEqual(['production', 'team']);
    });

    it('override prevalece sobre o plano (habilita e desabilita)', () => {
      const result = resolveEffectiveFeatures(
        ['production', 'inventory'],
        [
          { feature: 'inventory', enabled: false },
          { feature: 'warranty', enabled: true },
        ],
      );
      expect(result).toEqual(['production', 'warranty']);
    });

    it('ignora override de feature desconhecida', () => {
      const result = resolveEffectiveFeatures(
        ['production'],
        [{ feature: 'unknownFeature', enabled: false }],
      );
      expect(result).toEqual(['production']);
    });

    it('não duplica features', () => {
      const result = resolveEffectiveFeatures(
        ['production', 'production'],
        [{ feature: 'production', enabled: true }],
      );
      expect(result).toEqual(['production']);
    });
  });

  // ── CompanyFeaturesService ────────────────────────────────

  describe('CompanyFeaturesService', () => {
    let service: CompanyFeaturesService;
    let prisma: any;

    function mockSubscription(planFeatures?: string[] | null) {
      return {
        id: 'sub-1',
        companyId: COMPANY_ID,
        status: 'ACTIVE',
        plan: { id: 'plan-1', name: 'Profissional', features: planFeatures ?? [] },
      };
    }

    function mockOverride(overrides: Record<string, any> = {}) {
      return {
        id: 'ov-1',
        companyId: COMPANY_ID,
        feature: 'warranty',
        enabled: false,
        updatedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      };
    }

    beforeEach(() => {
      prisma = {
        subscription: { findFirst: jest.fn() },
        companyFeatureOverride: { findMany: jest.fn(), upsert: jest.fn() },
      };
      service = new CompanyFeaturesService(prisma);
    });

    describe('getEffectiveFeatures', () => {
      it('resolve plan.features + overrides da empresa', async () => {
        prisma.subscription.findFirst.mockResolvedValue(
          mockSubscription(['production', 'inventory', 'warranty']),
        );
        prisma.companyFeatureOverride.findMany.mockResolvedValue([
          mockOverride({ feature: 'warranty', enabled: false }),
        ]);

        const result = await service.getEffectiveFeatures(COMPANY_ID);

        expect(result).toEqual(['inventory', 'production']);
      });

      it('aplica override enabled=true para feature fora do plano', async () => {
        prisma.subscription.findFirst.mockResolvedValue(
          mockSubscription(['production']),
        );
        prisma.companyFeatureOverride.findMany.mockResolvedValue([
          mockOverride({ feature: 'team', enabled: true }),
        ]);

        const result = await service.getEffectiveFeatures(COMPANY_ID);

        expect(result).toEqual(['production', 'team']);
      });

      it('retorna todas as features por default quando o plano não tem features', async () => {
        prisma.subscription.findFirst.mockResolvedValue(mockSubscription([]));
        prisma.companyFeatureOverride.findMany.mockResolvedValue([]);

        const result = await service.getEffectiveFeatures(COMPANY_ID);

        expect(result).toEqual([...FEATURE_KEYS].sort());
      });

      it('retorna todas as features por default quando a empresa não tem subscription', async () => {
        prisma.subscription.findFirst.mockResolvedValue(null);
        prisma.companyFeatureOverride.findMany.mockResolvedValue([]);

        const result = await service.getEffectiveFeatures(COMPANY_ID);

        expect(result).toEqual([...FEATURE_KEYS].sort());
      });

      it('isola por tenant — busca subscription e overrides apenas da empresa', async () => {
        prisma.subscription.findFirst.mockResolvedValue(mockSubscription(['production']));
        prisma.companyFeatureOverride.findMany.mockResolvedValue([]);

        await service.getEffectiveFeatures(COMPANY_ID);

        expect(prisma.subscription.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ companyId: COMPANY_ID }),
          }),
        );
        expect(prisma.companyFeatureOverride.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ companyId: COMPANY_ID }),
          }),
        );
      });

      it('overrides de outra empresa não afetam a resolução (tenant isolation)', async () => {
        prisma.subscription.findFirst.mockResolvedValue(
          mockSubscription(['production', 'warranty', 'inventory']),
        );
        const allOverrides = [
          // Override de OUTRA empresa tentaria remover 'inventory' — deve ser ignorado
          mockOverride({ companyId: OTHER_COMPANY_ID, feature: 'inventory', enabled: false }),
          // Override da PRÓPRIA empresa remove 'warranty' — deve aplicar
          mockOverride({ companyId: COMPANY_ID, feature: 'warranty', enabled: false }),
        ];
        // Mock respeita o where — simula o scoping do Prisma no banco
        prisma.companyFeatureOverride.findMany.mockImplementation(
          ({ where }: { where: { companyId: string } }) =>
            Promise.resolve(allOverrides.filter((o) => o.companyId === where.companyId)),
        );

        const result = await service.getEffectiveFeatures(COMPANY_ID);

        // 'inventory' permanece (override de outra empresa ignorado);
        // 'warranty' sai (override da própria empresa aplica)
        expect(result).toEqual(['inventory', 'production']);
      });
    });

    describe('hasFeature', () => {
      it('retorna true quando a feature está habilitada', async () => {
        prisma.subscription.findFirst.mockResolvedValue(
          mockSubscription(['production', 'inventory']),
        );
        prisma.companyFeatureOverride.findMany.mockResolvedValue([]);

        expect(await service.hasFeature(COMPANY_ID, 'production')).toBe(true);
      });

      it('retorna false quando a feature está desabilitada por override', async () => {
        prisma.subscription.findFirst.mockResolvedValue(
          mockSubscription(['production', 'inventory']),
        );
        prisma.companyFeatureOverride.findMany.mockResolvedValue([
          mockOverride({ feature: 'inventory', enabled: false }),
        ]);

        expect(await service.hasFeature(COMPANY_ID, 'inventory')).toBe(false);
      });

      it('retorna false para feature desconhecida', async () => {
        prisma.subscription.findFirst.mockResolvedValue(
          mockSubscription(['production']),
        );
        prisma.companyFeatureOverride.findMany.mockResolvedValue([]);

        expect(await service.hasFeature(COMPANY_ID, 'not-a-feature')).toBe(false);
      });
    });

    describe('setOverride', () => {
      it('faz upsert com where composto companyId+feature (create)', async () => {
        prisma.companyFeatureOverride.upsert.mockResolvedValue(
          mockOverride({ feature: 'warranty', enabled: false, updatedById: 'user-1' }),
        );

        await service.setOverride(COMPANY_ID, 'warranty', false, 'user-1');

        expect(prisma.companyFeatureOverride.upsert).toHaveBeenCalledWith({
          where: { companyId_feature: { companyId: COMPANY_ID, feature: 'warranty' } },
          create: {
            companyId: COMPANY_ID,
            feature: 'warranty',
            enabled: false,
            updatedById: 'user-1',
          },
          update: {
            enabled: false,
            updatedById: 'user-1',
          },
        });
      });

      it('atualiza o override existente (update) com novo valor', async () => {
        prisma.companyFeatureOverride.upsert.mockResolvedValue(
          mockOverride({ feature: 'production', enabled: true }),
        );

        await service.setOverride(COMPANY_ID, 'production', true);

        expect(prisma.companyFeatureOverride.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { companyId_feature: { companyId: COMPANY_ID, feature: 'production' } },
            update: expect.objectContaining({ enabled: true }),
          }),
        );
      });

      it('rejeita feature desconhecida com BadRequestException', async () => {
        await expect(
          service.setOverride(COMPANY_ID, 'unknownFeature', true, 'user-1'),
        ).rejects.toThrow(BadRequestException);

        expect(prisma.companyFeatureOverride.upsert).not.toHaveBeenCalled();
      });
    });
  });

  // ── BusinessService.effectiveFeatures (delegação) ─────────

  describe('BusinessService.effectiveFeatures', () => {
    it('delega para CompanyFeaturesService.getEffectiveFeatures', async () => {
      const featuresService = {
        getEffectiveFeatures: jest.fn().mockResolvedValue(['production']),
      } as any;
      const biz = new BusinessService({} as any, {} as any, featuresService);

      const result = await biz.effectiveFeatures(COMPANY_ID);

      expect(featuresService.getEffectiveFeatures).toHaveBeenCalledWith(COMPANY_ID);
      expect(result).toEqual(['production']);
    });
  });
});
