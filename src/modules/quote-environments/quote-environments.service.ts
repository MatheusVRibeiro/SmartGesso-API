import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateQuoteEnvironmentDto } from './dto/create-quote-environment.dto';
import { UpdateQuoteEnvironmentDto } from './dto/update-quote-environment.dto';
import { CreateMeasurementDto } from '../measurements/dto/create-measurement.dto';
import { UpdateMeasurementDto } from '../measurements/dto/update-measurement.dto';

const ENVIRONMENT_INCLUDE = {
  measurements: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
  },
} as const;

/** Serializa Decimal do Prisma para number no retorno da API. */
function toNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/** Arredonda para 2 casas decimais (schema Decimal(15,2)). */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Cálculo automático de área e perímetro.
 * A API é a autoridade: se length E width estiverem presentes, os valores
 * enviados pelo cliente (area/perimeter) são ignorados e recalculados.
 * Caso contrário, usa os valores enviados (fallback) ou null.
 */
function computeAreaPerimeter(
  length?: number,
  width?: number,
  fallbackArea?: number | null,
  fallbackPerimeter?: number | null,
) {
  if (length !== undefined && width !== undefined) {
    return {
      area: round2(length * width),
      perimeter: round2(2 * (length + width)),
    };
  }
  return { area: fallbackArea ?? null, perimeter: fallbackPerimeter ?? null };
}

function serializeMeasurement(m: any) {
  return {
    ...m,
    length: toNumber(m.length),
    width: toNumber(m.width),
    ceilingHeight: toNumber(m.ceilingHeight),
    area: toNumber(m.area),
    perimeter: toNumber(m.perimeter),
  };
}

/**
 * Ambientes de orçamento e medições associadas, sem dependência de Work.
 * Todo acesso é escopado por companyId (vindo do request autenticado,
 * nunca do body), com cálculo automático de área/perímetro e soft delete.
 */
@Injectable()
export class QuoteEnvironmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------
  // Helpers de validação cross-tenant
  // ------------------------------------------------------------------

  /** Valida que o orçamento (quote) pertence à empresa ativa. */
  private async ensureQuoteBelongsToCompany(companyId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!quote) {
      throw new BadRequestException(
        'Orçamento inválido: não pertence à empresa ativa',
      );
    }
  }

  /** Valida que o ambiente pertence à empresa e ao orçamento informados. */
  private async ensureEnvironmentBelongsToCompany(
    companyId: string,
    quoteId: string,
    environmentId: string,
  ) {
    const env = await this.prisma.quoteEnvironment.findFirst({
      where: {
        id: environmentId,
        companyId,
        quoteId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!env) {
      throw new NotFoundException('Ambiente não encontrado');
    }
  }

  /** Valida que a medição pertence à empresa, ao orçamento e ao ambiente. */
  private async ensureMeasurementBelongsToEnvironment(
    companyId: string,
    quoteId: string,
    environmentId: string,
    measurementId: string,
  ) {
    const measurement = await this.prisma.measurement.findFirst({
      where: {
        id: measurementId,
        companyId,
        quoteEnvironmentId: environmentId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!measurement) {
      throw new NotFoundException('Medição não encontrada');
    }
  }

  // ------------------------------------------------------------------
  // CRUD de ambientes (QuoteEnvironment)
  // ------------------------------------------------------------------

  async createEnvironment(
    companyId: string,
    quoteId: string,
    dto: CreateQuoteEnvironmentDto,
  ) {
    await this.ensureQuoteBelongsToCompany(companyId, quoteId);

    const maxOrder = await this.prisma.quoteEnvironment.aggregate({
      where: { companyId, quoteId, deletedAt: null },
      _max: { order: true },
    });
    const order = dto.order ?? (maxOrder._max.order ?? 0) + 1;

    const environment = await this.prisma.quoteEnvironment.create({
      data: {
        companyId,
        quoteId,
        name: dto.name,
        description: dto.description,
        order,
      },
      include: ENVIRONMENT_INCLUDE,
    });

    return {
      ...environment,
      measurements: environment.measurements.map(serializeMeasurement),
    };
  }

  async findEnvironments(companyId: string, quoteId: string) {
    await this.ensureQuoteBelongsToCompany(companyId, quoteId);

    const environments = await this.prisma.quoteEnvironment.findMany({
      where: { companyId, quoteId, deletedAt: null },
      include: ENVIRONMENT_INCLUDE,
      orderBy: { order: 'asc' },
    });

    return environments.map((env) => ({
      ...env,
      measurements: env.measurements.map(serializeMeasurement),
    }));
  }

  async updateEnvironment(
    companyId: string,
    quoteId: string,
    environmentId: string,
    dto: UpdateQuoteEnvironmentDto,
  ) {
    await this.ensureEnvironmentBelongsToCompany(
      companyId,
      quoteId,
      environmentId,
    );

    const { order, ...data } = dto;

    const environment = await this.prisma.quoteEnvironment.update({
      where: { id: environmentId },
      data: {
        ...data,
        ...(order !== undefined ? { order } : {}),
      },
      include: ENVIRONMENT_INCLUDE,
    });

    return {
      ...environment,
      measurements: environment.measurements.map(serializeMeasurement),
    };
  }

  /** Soft delete: marca deletedAt, não remove o registro. */
  async removeEnvironment(
    companyId: string,
    quoteId: string,
    environmentId: string,
  ) {
    await this.ensureEnvironmentBelongsToCompany(
      companyId,
      quoteId,
      environmentId,
    );

    const deletedAt = new Date();
    await this.prisma.quoteEnvironment.update({
      where: { id: environmentId },
      data: { deletedAt },
    });
    return { id: environmentId, deletedAt, deleted: true };
  }

  // ------------------------------------------------------------------
  // CRUD de medições dentro de ambientes
  // ------------------------------------------------------------------

  async createMeasurement(
    companyId: string,
    quoteId: string,
    environmentId: string,
    dto: CreateMeasurementDto,
  ) {
    await this.ensureEnvironmentBelongsToCompany(
      companyId,
      quoteId,
      environmentId,
    );

    const { area, perimeter } = computeAreaPerimeter(
      dto.length,
      dto.width,
      dto.area,
      dto.perimeter,
    );

    const measurement = await this.prisma.measurement.create({
      data: {
        companyId,
        quoteEnvironmentId: environmentId,
        environmentName: dto.environmentName,
        applicationType: dto.applicationType,
        length: dto.length,
        width: dto.width,
        ceilingHeight: dto.ceilingHeight,
        area,
        perimeter,
        doors: dto.doors,
        windows: dto.windows,
        cutouts: dto.cutouts,
        fixtures: dto.fixtures,
        hasCove: dto.hasCove,
        hasDropCeiling: dto.hasDropCeiling,
        observations: dto.observations,
      },
    });

    return serializeMeasurement(measurement);
  }

  async updateMeasurement(
    companyId: string,
    quoteId: string,
    environmentId: string,
    measurementId: string,
    dto: UpdateMeasurementDto,
  ) {
    await this.ensureMeasurementBelongsToEnvironment(
      companyId,
      quoteId,
      environmentId,
      measurementId,
    );

    const existing = await this.prisma.measurement.findFirst({
      where: { id: measurementId, companyId, deletedAt: null },
    });

    const length = dto.length ?? toNumber(existing?.length) ?? undefined;
    const width = dto.width ?? toNumber(existing?.width) ?? undefined;
    const { area, perimeter } = computeAreaPerimeter(
      length,
      width,
      dto.area ?? toNumber(existing?.area),
      dto.perimeter ?? toNumber(existing?.perimeter),
    );

    const measurement = await this.prisma.measurement.update({
      where: { id: measurementId },
      data: {
        environmentName: dto.environmentName,
        applicationType: dto.applicationType,
        length: dto.length,
        width: dto.width,
        ceilingHeight: dto.ceilingHeight,
        area,
        perimeter,
        doors: dto.doors,
        windows: dto.windows,
        cutouts: dto.cutouts,
        fixtures: dto.fixtures,
        hasCove: dto.hasCove,
        hasDropCeiling: dto.hasDropCeiling,
        observations: dto.observations,
      },
    });

    return serializeMeasurement(measurement);
  }

  // ------------------------------------------------------------------
  // Leitura de medições para cálculo de composição
  // ------------------------------------------------------------------

  /**
   * Busca todas as medições ativas de todos os ambientes de um orçamento.
   * Usado pelo cálculo de composição para consumir medições sem depender de Work.
   */
  async findMeasurementsByQuote(companyId: string, quoteId: string) {
    await this.ensureQuoteBelongsToCompany(companyId, quoteId);

    const environments = await this.prisma.quoteEnvironment.findMany({
      where: { companyId, quoteId, deletedAt: null },
      include: {
        measurements: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    return environments.flatMap((env) =>
      env.measurements.map((m) => ({
        ...serializeMeasurement(m),
        environmentId: env.id,
        environmentName: env.name,
      })),
    );
  }
}
