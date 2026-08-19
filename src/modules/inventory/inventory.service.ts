import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovement,
  InventoryMovementType,
  Material,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdjustMaterialStockDto } from './dto/adjust-material-stock.dto';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';

/**
 * Estoque: movimentos de inventário (entrada, saída, reserva, consumo,
 * perda, ajuste e retorno) com atualização atômica do stockQty do material.
 * Todo acesso é escopado por companyId (vindo do request autenticado, nunca do body).
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /** Converte Decimal do Prisma para number no retorno da API. */
  private toNumber(value: unknown): number | null {
    return value === null || value === undefined ? null : Number(value);
  }

  private serializeMovement(m: InventoryMovement) {
    return {
      ...m,
      quantity: this.toNumber(m.quantity),
      unitCost: this.toNumber(m.unitCost),
    };
  }

  private serializeMaterial(mat: Material) {
    return {
      ...mat,
      price: this.toNumber(mat.price),
      cost: this.toNumber(mat.cost),
      stockQty: this.toNumber(mat.stockQty),
      minStockQty: this.toNumber(mat.minStockQty),
    };
  }

  /** Tipos que reduzem o estoque físico. */
  private isDecrement(type: InventoryMovementType): boolean {
    return (
      type === InventoryMovementType.SAIDA ||
      type === InventoryMovementType.CONSUMO ||
      type === InventoryMovementType.PERDA
    );
  }

  /** Tipos que aumentam o estoque físico. */
  private isIncrement(type: InventoryMovementType): boolean {
    return (
      type === InventoryMovementType.ENTRADA ||
      type === InventoryMovementType.RETORNO
    );
  }

  private async findMaterialOrThrow(companyId: string, id: string) {
    const material = await this.prisma.material.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!material) throw new NotFoundException('Material não encontrado');
    return material;
  }

  private async assertServiceOrderBelongsToCompany(
    companyId: string,
    serviceOrderId: string,
  ) {
    const exists = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!exists)
      throw new BadRequestException('Ordem de serviço não encontrada');
  }

  // ------------------------------------------------------------------
  // Movimentos
  // ------------------------------------------------------------------

  /**
   * Cria um movimento de estoque e atualiza o stockQty do material
   * atomicamente (transação).
   *
   * Regras:
   *  - ENTRADA/RETORNO: stockQty += quantity
   *  - SAIDA/CONSUMO/PERDA: stockQty -= quantity (valida estoque não negativo)
   *  - RESERVA: não altera stockQty
   *  - AJUSTE: stockQty = quantity (quantity é o valor final)
   */
  async createMovement(companyId: string, dto: CreateInventoryMovementDto) {
    if (dto.quantity === 0 && dto.type !== InventoryMovementType.AJUSTE) {
      throw new BadRequestException('Quantidade deve ser maior que zero');
    }

    await this.findMaterialOrThrow(companyId, dto.materialId);
    if (dto.serviceOrderId) {
      await this.assertServiceOrderBelongsToCompany(
        companyId,
        dto.serviceOrderId,
      );
    }

    const { movement, material } = await this.prisma.$transaction(
      async (tx) => {
        let material: Material;

        if (this.isDecrement(dto.type)) {
          // Decremento atômico condicional: só atualiza se houver saldo suficiente.
          const result = await tx.material.updateMany({
            where: {
              id: dto.materialId,
              companyId,
              deletedAt: null,
              stockQty: { gte: dto.quantity },
            },
            data: { stockQty: { decrement: dto.quantity } },
          });
          if (result.count !== 1) {
            throw new BadRequestException(
              'Estoque insuficiente para o movimento',
            );
          }
          material = (await tx.material.findUnique({
            where: { id: dto.materialId },
          })) as Material;
        } else if (this.isIncrement(dto.type)) {
          material = await tx.material.update({
            where: { id: dto.materialId },
            data: { stockQty: { increment: dto.quantity } },
          });
        } else if (dto.type === InventoryMovementType.AJUSTE) {
          material = await tx.material.update({
            where: { id: dto.materialId },
            data: { stockQty: dto.quantity },
          });
        } else {
          // RESERVA: não altera o estoque físico.
          material = (await tx.material.findUnique({
            where: { id: dto.materialId },
          })) as Material;
        }

        const movement = await tx.inventoryMovement.create({
          data: {
            companyId,
            materialId: dto.materialId,
            serviceOrderId: dto.serviceOrderId ?? null,
            type: dto.type,
            quantity: dto.quantity,
            unitCost: dto.unitCost ?? null,
            notes: dto.notes ?? null,
          },
        });

        return { movement, material };
      },
    );

    return {
      movement: this.serializeMovement(movement),
      material: this.serializeMaterial(material),
    };
  }

  /** Lista movimentos com filtros opcionais por material, OS e tipo. */
  async listMovements(
    companyId: string,
    filters: {
      materialId?: string;
      serviceOrderId?: string;
      type?: InventoryMovementType;
    },
  ) {
    const where: Record<string, unknown> = {
      companyId,
      deletedAt: null,
    };
    if (filters.materialId) where.materialId = filters.materialId;
    if (filters.serviceOrderId) where.serviceOrderId = filters.serviceOrderId;
    if (filters.type) where.type = filters.type;

    const items = await this.prisma.inventoryMovement.findMany({
      where,
      include: {
        material: { select: { id: true, name: true, unit: true } },
        serviceOrder: { select: { id: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((m) => ({
      ...this.serializeMovement(m),
      material: m.material,
      serviceOrder: m.serviceOrder,
    }));
  }

  // ------------------------------------------------------------------
  // Materiais (visão de estoque)
  // ------------------------------------------------------------------

  /** Lista materiais com saldo, estoque mínimo e custo. */
  async listMaterials(companyId: string, search?: string) {
    const term = search?.trim();
    const items = await this.prisma.material.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(term
          ? {
              OR: [
                { name: { contains: term } },
                { description: { contains: term } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    });
    return items.map((m) => this.serializeMaterial(m));
  }

  /** Histórico de movimentos de um material específico. */
  async getMaterialMovements(companyId: string, materialId: string) {
    await this.findMaterialOrThrow(companyId, materialId);
    const items = await this.prisma.inventoryMovement.findMany({
      where: { companyId, materialId, deletedAt: null },
      include: {
        serviceOrder: { select: { id: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((m) => ({
      ...this.serializeMovement(m),
      serviceOrder: m.serviceOrder,
    }));
  }

  /** Ajuste manual: define o estoque para o valor informado (movimento AJUSTE). */
  async adjustStock(
    companyId: string,
    materialId: string,
    dto: AdjustMaterialStockDto,
  ) {
    await this.findMaterialOrThrow(companyId, materialId);

    const { movement, material } = await this.prisma.$transaction(
      async (tx) => {
        const material = await tx.material.update({
          where: { id: materialId },
          data: { stockQty: dto.quantity },
        });
        const movement = await tx.inventoryMovement.create({
          data: {
            companyId,
            materialId,
            serviceOrderId: null,
            type: InventoryMovementType.AJUSTE,
            quantity: dto.quantity,
            unitCost: null,
            notes: dto.notes ?? null,
          },
        });
        return { movement, material };
      },
    );

    return {
      movement: this.serializeMovement(movement),
      material: this.serializeMaterial(material),
    };
  }
}