import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Measurement } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { UpdateMeasurementDto } from './dto/update-measurement.dto';

const MEASUREMENT_INCLUDE = {
  work: { select: { id: true, name: true } },
} as const;

/**
 * Medições de obras: CRUD escopado por companyId (vindo do request autenticado,
 * nunca do body), com cálculo automático de área/perímetro e soft delete.
 */
@Injectable()
export class MeasurementsService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /** Converte Decimal do Prisma para number no retorno da API. */
  private toNumber(value: unknown): number | null {
    return value === null || value === undefined ? null : Number(value);
  }

  /** Arredonda para 2 casas decimais (schema Decimal(15,2)). */
  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Cálculo automático de área e perímetro.
   * A API é a autoridade: se length E width estiverem presentes, os valores
   * enviados pelo cliente (area/perimeter) são ignorados e recalculados.
   * Caso contrário, usa os valores enviados (fallback) ou null.
   */
  private computeAreaPerimeter(
    length?: number,
    width?: number,
    fallbackArea?: number | null,
    fallbackPerimeter?: number | null,
  ) {
    if (length !== undefined && width !== undefined) {
      return {
        area: this.round2(length * width),
        perimeter: this.round2(2 * (length + width)),
      };
    }
    return { area: fallbackArea ?? null, perimeter: fallbackPerimeter ?? null };
  }

  private serialize(m: Measurement) {
    return {
      ...m,
      length: this.toNumber(m.length),
      width: this.toNumber(m.width),
      ceilingHeight: this.toNumber(m.ceilingHeight),
      area: this.toNumber(m.area),
      perimeter: this.toNumber(m.perimeter),
    };
  }

  /** Validação de FK cross-tenant: a obra DEVE pertencer à empresa ativa. */
  private async ensureWorkBelongsToCompany(companyId: string, workId: string) {
    const work = await this.prisma.work.findFirst({
      where: { id: workId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!work) {
      throw new BadRequestException('Obra inválida: não pertence à empresa ativa');
    }
  }

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------

  async create(companyId: string, workId: string, dto: CreateMeasurementDto) {
    await this.ensureWorkBelongsToCompany(companyId, workId);

    const { area, perimeter } = this.computeAreaPerimeter(
      dto.length,
      dto.width,
      dto.area,
      dto.perimeter,
    );

    const measurement = await this.prisma.measurement.create({
      data: {
        companyId,
        workId,
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
      include: MEASUREMENT_INCLUDE,
    });

    return this.serialize(measurement);
  }

  async findAll(companyId: string, workId: string) {
    const measurements = await this.prisma.measurement.findMany({
      where: { companyId, workId, deletedAt: null },
      include: MEASUREMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return measurements.map((m) => this.serialize(m));
  }

  async findOne(companyId: string, id: string) {
    const measurement = await this.prisma.measurement.findFirst({
      where: { id, companyId, deletedAt: null },
      include: MEASUREMENT_INCLUDE,
    });
    if (!measurement) throw new NotFoundException('Medição não encontrada');
    return this.serialize(measurement);
  }

  async update(companyId: string, id: string, dto: UpdateMeasurementDto) {
    const existing = await this.prisma.measurement.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Medição não encontrada');

    // Mescla dimensões atuais com as enviadas para recalcular área/perímetro.
    const length = dto.length ?? this.toNumber(existing.length) ?? undefined;
    const width = dto.width ?? this.toNumber(existing.width) ?? undefined;
    const { area, perimeter } = this.computeAreaPerimeter(
      length,
      width,
      dto.area ?? this.toNumber(existing.area),
      dto.perimeter ?? this.toNumber(existing.perimeter),
    );

    const measurement = await this.prisma.measurement.update({
      where: { id },
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
      include: MEASUREMENT_INCLUDE,
    });

    return this.serialize(measurement);
  }

  /** Soft delete: marca deletedAt, não remove o registro. */
  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    const deletedAt = new Date();
    await this.prisma.measurement.update({
      where: { id },
      data: { deletedAt },
    });
    return { id, deletedAt, deleted: true };
  }
}