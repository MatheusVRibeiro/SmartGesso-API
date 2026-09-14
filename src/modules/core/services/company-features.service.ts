import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  FEATURE_KEYS,
  FeatureKey,
  getEffectiveFeatures as resolveEffective,
  isFeatureKey,
} from '../company-features';

/**
 * CompanyFeaturesService — ETAPA 13 V4.
 *
 * Resolve as features efetivas de uma empresa (Plan.features + overrides) e
 * gerencia os overrides por empresa (CompanyFeatureOverride).
 *
 * Registrado no CoreModule (@Global) como provider+export, fica injetável em
 * guards, controllers e no BusinessService.
 */
@Injectable()
export class CompanyFeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Features efetivas da empresa: plan.features + overrides (habilita/desabilita).
   */
  async getEffectiveFeatures(companyId: string): Promise<string[]> {
    return resolveEffective(this.prisma, companyId);
  }

  /**
   * Verifica se a empresa possui uma feature específica habilitada.
   * Features desconhecidas (fora de FEATURE_KEYS) nunca estão habilitadas.
   */
  async hasFeature(companyId: string, feature: string): Promise<boolean> {
    const features = await this.getEffectiveFeatures(companyId);
    return features.includes(feature);
  }

  /**
   * Lista os overrides de features da empresa (tenant-scoped).
   */
  async listOverrides(companyId: string) {
    return this.prisma.companyFeatureOverride.findMany({
      where: { companyId },
      orderBy: { feature: 'asc' },
    });
  }

  /**
   * Cria/atualiza um override de feature para a empresa (upsert por
   * @@unique([companyId, feature])).
   *
   * @param feature  Feature conhecida (FEATURE_KEYS) — caso contrário BadRequest.
   * @param enabled  true habilita a feature, false desabilita.
   * @param userId   Usuário autenticado que realizou a alteração (auditoria).
   */
  async setOverride(
    companyId: string,
    feature: string,
    enabled: boolean,
    userId?: string,
  ) {
    if (!isFeatureKey(feature)) {
      throw new BadRequestException(
        `Feature desconhecida. Features válidas: ${FEATURE_KEYS.join(', ')}`,
      );
    }

    const key = feature as FeatureKey;

    return this.prisma.companyFeatureOverride.upsert({
      where: { companyId_feature: { companyId, feature: key } },
      create: {
        companyId,
        feature: key,
        enabled,
        updatedById: userId ?? null,
      },
      update: {
        enabled,
        updatedById: userId ?? null,
      },
    });
  }
}
