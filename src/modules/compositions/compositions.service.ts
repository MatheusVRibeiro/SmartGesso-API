import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CalculateMaterialsDto,
  CreateCompositionDto,
  FormulaBasedOn,
  UpdateCompositionDto,
} from './dto';

/** Fórmula armazenada no campo Json de CompositionItem. */
interface CompositionFormula {
  factor: number;
  basedOn: FormulaBasedOn;
}

/** Itens da composição padrão DRYWALL (seed idempotente por empresa). */
const DRYWALL_ITEMS: ReadonlyArray<{
  materialType: string;
  name: string;
  unit: string;
  formula: CompositionFormula;
}> = [
  { materialType: 'PLACA', name: 'Placa de Gesso', unit: 'm²', formula: { factor: 1.05, basedOn: 'area' } },
  { materialType: 'PERFIL', name: 'Perfil', unit: 'm', formula: { factor: 3.2, basedOn: 'area' } },
  { materialType: 'GUIA', name: 'Guia', unit: 'm', formula: { factor: 0.8, basedOn: 'perimeter' } },
  { materialType: 'MONTANTE', name: 'Montante', unit: 'm', formula: { factor: 2.5, basedOn: 'area' } },
  { materialType: 'PARAFUSO', name: 'Parafuso', unit: 'un', formula: { factor: 12, basedOn: 'area' } },
  { materialType: 'FITA', name: 'Fita', unit: 'm', formula: { factor: 1.2, basedOn: 'perimeter' } },
  { materialType: 'MASSA', name: 'Massa', unit: 'kg', formula: { factor: 0.5, basedOn: 'area' } },
];

const COMPOSITION_INCLUDE = { items: true } as const;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Composições versionadas de materiais (drywall, forro, parede, sanca...).
 * Todo acesso é escopado por companyId (vindo do request autenticado, nunca do body).
 */
@Injectable()
export class CompositionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------

  async create(companyId: string, dto: CreateCompositionDto) {
    const agg = await this.prisma.composition.aggregate({
      where: { companyId, code: dto.code },
      _max: { version: true },
    });
    const version = dto.version ?? (agg._max.version ?? 0) + 1;

    return this.prisma.composition.create({
      data: {
        companyId,
        code: dto.code,
        name: dto.name,
        version,
        applicationType: dto.applicationType,
        status: dto.status ?? 'ACTIVE',
        ...(dto.items?.length
          ? {
              items: {
                create: dto.items.map((i) => ({
                  materialType: i.materialType,
                  name: i.name,
                  unit: i.unit ?? 'un',
                  formula: i.formula as unknown as Prisma.InputJsonValue,
                })),
              },
            }
          : {}),
      },
      include: COMPOSITION_INCLUDE,
    });
  }

  async findAll(companyId: string) {
    await this.ensureDefaultDrywall(companyId);
    return this.prisma.composition.findMany({
      where: { companyId, status: 'ACTIVE', deletedAt: null },
      include: COMPOSITION_INCLUDE,
      orderBy: [{ code: 'asc' }, { version: 'desc' }],
    });
  }

  async findOne(companyId: string, id: string) {
    const composition = await this.prisma.composition.findFirst({
      where: { id, companyId, deletedAt: null },
      include: COMPOSITION_INCLUDE,
    });
    if (!composition) throw new NotFoundException('Composição não encontrada');
    return composition;
  }

  async update(companyId: string, id: string, dto: UpdateCompositionDto) {
    await this.findOne(companyId, id);

    const { items, ...data } = dto;
    if (Object.keys(data).length === 0 && !items) {
      throw new BadRequestException('Nenhum campo para atualizar');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.composition.update({
        where: { id },
        data: { ...data },
      });

      if (items) {
        await tx.compositionItem.deleteMany({ where: { compositionId: id } });
        await tx.compositionItem.createMany({
          data: items.map((i) => ({
            compositionId: id,
            materialType: i.materialType,
            name: i.name,
            unit: i.unit ?? 'un',
            formula: i.formula as unknown as Prisma.InputJsonValue,
          })),
        });
      }

      return tx.composition.findUnique({
        where: { id },
        include: COMPOSITION_INCLUDE,
      });
    });
  }

  /** Soft delete: marca deletedAt, não remove o registro. */
  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.composition.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ------------------------------------------------------------------
  // Cálculo de materiais
  // ------------------------------------------------------------------

  async calculate(companyId: string, dto: CalculateMaterialsDto) {
    await this.ensureDefaultDrywall(companyId);

    // Totais a partir das medições (área derivada de length × width quando ausente)
    let areaTotal = 0;
    let perimeterTotal = 0;
    let lengthTotal = 0;
    for (const m of dto.measurements) {
      const area = m.area ?? (m.length != null && m.width != null ? m.length * m.width : 0);
      areaTotal += area;
      perimeterTotal += m.perimeter ?? 0;
      lengthTotal += m.length ?? 0;
    }
    areaTotal = round2(areaTotal);
    perimeterTotal = round2(perimeterTotal);
    lengthTotal = round2(lengthTotal);

    if (areaTotal <= 0 && perimeterTotal <= 0 && lengthTotal <= 0) {
      throw new BadRequestException(
        'Informe area (ou length/width) ou perimeter em pelo menos uma medição',
      );
    }

    // Composição ativa de maior versão para o tipo de aplicação
    const composition = await this.prisma.composition.findFirst({
      where: {
        companyId,
        applicationType: dto.applicationType,
        status: 'ACTIVE',
        deletedAt: null,
      },
      orderBy: { version: 'desc' },
      include: COMPOSITION_INCLUDE,
    });
    if (!composition) {
      throw new NotFoundException(
        'Nenhuma composição ativa encontrada para o tipo de aplicação informado',
      );
    }

    const items: Array<{
      materialType: string;
      name: string;
      unit: string;
      quantity: number;
      unitPrice: number | null;
      total: number | null;
    }> = [];
    let estimatedCost = 0;

    for (const item of composition.items) {
      const formula = (item.formula ?? {}) as unknown as CompositionFormula;
      const factor = Number(formula.factor ?? 0);
      const basedOn = formula.basedOn ?? 'unit';

      let quantity = 0;
      switch (basedOn) {
        case 'area':
          quantity = areaTotal * factor;
          break;
        case 'perimeter':
          quantity = perimeterTotal * factor;
          break;
        case 'length':
          quantity = lengthTotal * factor;
          break;
        default:
          quantity = factor;
      }
      quantity = round2(quantity);

      const unitPrice = await this.findMaterialUnitPrice(companyId, item.name);
      const total = unitPrice != null ? round2(quantity * unitPrice) : null;
      if (total != null) estimatedCost += total;

      items.push({
        materialType: item.materialType,
        name: item.name,
        unit: item.unit,
        quantity,
        unitPrice,
        total,
      });
    }

    return {
      composition: {
        code: composition.code,
        name: composition.name,
        version: composition.version,
      },
      items,
      totalArea: areaTotal,
      estimatedCost: round2(estimatedCost),
    };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /** Preço unitário do Material do catálogo da empresa cujo nome contém o nome do item (LIKE). */
  private async findMaterialUnitPrice(companyId: string, name: string): Promise<number | null> {
    const material = await this.prisma.material.findFirst({
      where: { companyId, deletedAt: null, name: { contains: name } },
      orderBy: { name: 'asc' },
      select: { price: true },
    });
    return material?.price != null ? Number(material.price) : null;
  }

  /** Seed idempotente: cria a composição padrão DRYWALL (versão 1) se a empresa ainda não tiver. */
  private async ensureDefaultDrywall(companyId: string) {
    const existing = await this.prisma.composition.findFirst({
      where: { companyId, code: 'DRYWALL', deletedAt: null },
      select: { id: true },
    });
    if (existing) return;

    await this.prisma.composition.create({
      data: {
        companyId,
        code: 'DRYWALL',
        name: 'Drywall Padrão',
        version: 1,
        applicationType: 'DRYWALL',
        status: 'ACTIVE',
        items: {
          create: DRYWALL_ITEMS.map((i) => ({
            materialType: i.materialType,
            name: i.name,
            unit: i.unit,
            formula: i.formula as unknown as Prisma.InputJsonValue,
          })),
        },
      },
    });
  }
}