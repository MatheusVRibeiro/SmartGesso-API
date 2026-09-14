import type { PrismaClient } from '@prisma/client';

/**
 * Feature flags do SmartGesso (ETAPA 13 V4).
 *
 * Resolução:
 *   EffectiveFeatures = Plan.features (base) + CompanyFeatureOverride (habilita/desabilita)
 *
 * - FEATURE_KEYS: lista canônica de features conhecidas.
 * - DEFAULT_FEATURES: quando o plano não define features (lista vazia/ausente),
 *   todas as features conhecidas são consideradas habilitadas por padrão.
 * - Override por empresa: um registro CompanyFeatureOverride com `enabled=true`
 *   adiciona a feature (mesmo que o plano não a inclua); `enabled=false` remove.
 */

export const FEATURE_KEYS = [
  'production',
  'inventory',
  'purchases',
  'team',
  'advancedFinance',
  'warranty',
  'pushNotifications',
  'customBranding',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const DEFAULT_FEATURES: Record<FeatureKey, boolean> = {
  production: true,
  inventory: true,
  purchases: true,
  team: true,
  advancedFinance: true,
  warranty: true,
  pushNotifications: true,
  customBranding: true,
};

export interface FeatureOverrideInput {
  feature: string;
  enabled: boolean;
}

export function isFeatureKey(feature: string): feature is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(feature);
}

/**
 * Resolve as features efetivas a partir das features do plano e dos overrides
 * da empresa (função pura — sem acesso a banco).
 *
 * @param planFeatures  Features declaradas no plano (string[]). Lista vazia/ausente
 *                      => todas as FEATURE_KEYS habilitadas (DEFAULT_FEATURES).
 * @param overrides     Overrides da empresa (feature + enabled). enabled=true adiciona,
 *                      enabled=false remove da lista efetiva.
 */
export function resolveEffectiveFeatures(
  planFeatures: string[] | null | undefined,
  overrides: FeatureOverrideInput[],
): string[] {
  const base =
    planFeatures && planFeatures.length > 0
      ? planFeatures.filter((f): f is FeatureKey => isFeatureKey(f))
      : [...FEATURE_KEYS];

  const effective = new Set<string>(base);

  for (const override of overrides) {
    if (!isFeatureKey(override.feature)) continue;
    if (override.enabled) effective.add(override.feature);
    else effective.delete(override.feature);
  }

  return [...effective].sort();
}

/**
 * Busca as features efetivas de uma empresa direto no banco:
 * subscription mais recente → plan.features (base) + overrides da empresa.
 *
 * @param prisma     Cliente Prisma (PrismaService).
 * @param companyId  Empresa autenticada/selecionada (tenant scope).
 */
export async function getEffectiveFeatures(
  prisma: Pick<PrismaClient, 'subscription' | 'companyFeatureOverride'>,
  companyId: string,
): Promise<string[]> {
  const subscription = await prisma.subscription.findFirst({
    where: { companyId },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });

  const planFeatures = (subscription?.plan?.features ?? []) as string[];

  const overrides = await prisma.companyFeatureOverride.findMany({
    where: { companyId },
  });

  return resolveEffectiveFeatures(
    planFeatures,
    overrides.map((o) => ({ feature: o.feature, enabled: o.enabled })),
  );
}
