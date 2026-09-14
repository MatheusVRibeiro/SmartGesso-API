import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  Prisma,
  PurchaseOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';

/**
 * Matriz de transições de status válidas para PurchaseOrder.
 *
 * Fluxo canônico:
 *   DRAFT → ORDERED → RECEIVED
 *         ↘ CANCELLED (a qualquer momento antes de RECEIVED)
 *
 * RECEIVED e CANCELLED são estados terminais — não saem deles.
 */
const STATUS_TRANSITIONS: Record<
  PurchaseOrderStatus,
  PurchaseOrderStatus[]
> = {
  DRAFT: ['ORDERED', 'CANCELLED'],
  ORDERED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
};

const PO_INCLUDE = {
  supplier: { select: { id: true, name: true } },
  serviceOrder: { select: { id: true, code: true } },
  items: true,
} as const;

/**
 * Pedidos de compra (ETAPA 10 — Fornecedores e Compras).
 *
 * Todo acesso é escopado por companyId (vindo do request autenticado, nunca do body).
 * Ao transitar para RECEIVED, cria movimentos de entrada no inventário para itens
 * cujo catalogItemId referencia um Material.
 */
@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private toNumber(value: unknown): number | null {
    return value === null || value === undefined ? null : Number(value);
  }

  private serializeItem(item: any) {
    return {
      ...item,
      quantity: this.toNumber(item.quantity),
      unitPrice: this.toNumber(item.unitPrice),
      total: this.toNumber(item.total),
    };
  }

  private serializePO(po: any) {
    return {
      ...po,
      total: this.toNumber(po.total),
      items: po.items?.map((i: any) => this.serializeItem(i)),
    };
  }

  private async ensureSupplierBelongsToCompany(
    companyId: string,
    supplierId: string,
  ) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!supplier) {
      throw new BadRequestException(
        'Fornecedor inválido: não pertence à empresa ativa',
      );
    }
  }

  private async ensureServiceOrderBelongsToCompany(
    companyId: string,
    serviceOrderId: string,
  ) {
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!so) {
      throw new BadRequestException(
        'Ordem de serviço inválida: não pertence à empresa ativa',
      );
    }
  }

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------

  /** Lista pedidos da empresa, opcionalmente filtrados por serviceOrderId. */
  async findAll(companyId: string, serviceOrderId?: string) {
    const where: Prisma.PurchaseOrderWhereInput = {
      companyId,
      deletedAt: null,
    };
    if (serviceOrderId) {
      where.serviceOrderId = serviceOrderId;
    }

    const orders = await this.prisma.purchaseOrder.findMany({
      where,
      include: PO_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((po) => this.serializePO(po));
  }

  /** Busca um pedido por id, scoped pela empresa. */
  async findOne(companyId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: PO_INCLUDE,
    });
    if (!po) throw new NotFoundException('Pedido de compra não encontrado');
    return this.serializePO(po);
  }

  /**
   * Cria um pedido de compra com itens. O total é calculado automaticamente
   * como a soma dos totais dos itens (quantity * unitPrice, ou o total
   * informado no item quando presente).
   */
  async create(companyId: string, dto: CreatePurchaseOrderDto) {
    if (dto.supplierId) {
      await this.ensureSupplierBelongsToCompany(companyId, dto.supplierId);
    }
    if (dto.serviceOrderId) {
      await this.ensureServiceOrderBelongsToCompany(
        companyId,
        dto.serviceOrderId,
      );
    }

    // Calcula o total do PO somando os totais dos itens.
    const total = dto.items.reduce(
      (sum, item) =>
        sum.plus(
          new Prisma.Decimal(item.total ?? item.quantity * item.unitPrice),
        ),
      new Prisma.Decimal(0),
    );

    const created = await this.prisma.purchaseOrder.create({
      data: {
        companyId,
        supplierId: dto.supplierId,
        serviceOrderId: dto.serviceOrderId,
        notes: dto.notes,
        total,
        items: {
          create: dto.items.map((item) => ({
            catalogItemId: item.catalogItemId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total ?? item.quantity * item.unitPrice,
          })),
        },
      },
      include: PO_INCLUDE,
    });

    return this.serializePO(created);
  }

  /**
   * Transiciona o status do pedido validando contra a matriz canônica.
   *
   * Ao RECEIVED: cria movimentos de entrada no inventário para cada item
   * cujo catalogItemId referencia um Material pertencente à empresa.
   */
  async updateStatus(
    companyId: string,
    id: string,
    status: PurchaseOrderStatus,
  ) {
    const existing = await this.findOne(companyId, id);

    const allowed = STATUS_TRANSITIONS[existing.status as PurchaseOrderStatus];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Transição inválida: ${existing.status} → ${status}`,
      );
    }

    // Ao RECEIVED: cria movimentos de entrada no inventário.
    if (status === 'RECEIVED') {
      await this.createInventoryMovements(companyId, id, existing.items);
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status },
      include: PO_INCLUDE,
    });

    return this.serializePO(updated);
  }

  /** Soft delete: marca deletedAt, não remove o registro. */
  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ------------------------------------------------------------------
  // Integração com inventário
  // ------------------------------------------------------------------

  /**
   * Ao RECEIVED: para cada item com catalogItemId que referencia um Material
   * pertencente à empresa, cria um InventoryMovement de ENTRADA.
   *
   * Não altera o inventário além de criar movimentos de entrada — a regra de
   * "se inventário existir" é satisfeita verificando se o catalogItemId é um
   * Material ativo da empresa.
   */
  private async createInventoryMovements(
    companyId: string,
    poId: string,
    items: any[],
  ) {
    for (const item of items) {
      if (!item.catalogItemId) continue;

      // Verifica se o catalogItemId é um Material (possui inventário).
      const material = await this.prisma.material.findFirst({
        where: {
          id: item.catalogItemId,
          companyId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!material) continue; // Não é um material ou não pertence à empresa

      await this.inventory.createMovement(companyId, {
        materialId: item.catalogItemId,
        type: InventoryMovementType.ENTRADA,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitPrice),
        notes: `Entrada via recebimento de PO #${poId}`,
      });
    }
  }
}
