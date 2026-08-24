import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { RegisterServiceOrderResultDto } from './dto/register-service-order-result.dto';

const SERVICE_ORDER_INCLUDE = {
  client: { select: { id: true, name: true } },
  work: { select: { id: true, name: true } },
  materials: true,
} as const;

@Injectable()
export class ServiceOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateServiceOrderDto) {
    try {
      await this.ensureClientBelongsToCompany(companyId, dto.clientId);
      if (dto.workId) {
        await this.ensureWorkBelongsToCompany(companyId, dto.workId);
      }

      const code = await this.generateCode(companyId);

      const profit = this.calculateProfit(dto.cost, dto.saleValue);

      return this.convertDecimals(
        await this.prisma.serviceOrder.create({
          data: {
            companyId,
            clientId: dto.clientId,
            workId: dto.workId,
            code,
            status: dto.status,
            scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
            completedDate: dto.completedDate ? new Date(dto.completedDate) : undefined,
            cost: dto.cost,
            saleValue: dto.saleValue,
            profit,
            observations: dto.observations,
            checklist: dto.checklist,
            materials: dto.materials
              ? {
                  create: dto.materials.map((m) => ({
                    materialName: m.materialName,
                    quantity: m.quantity,
                    unit: m.unit,
                  })),
                }
              : undefined,
          },
          include: SERVICE_ORDER_INCLUDE,
        }),
      );
    } catch (error) {
      console.error('SERVICE_ORDER CREATE ERROR:', error);
      throw error;
    }
  }

  async findAll(companyId: string, search?: string, status?: string) {
    const where: Prisma.ServiceOrderWhereInput = {
      companyId,
      deletedAt: null,
      ...(status ? { status: status as any } : {}),
      ...(search
        ? {
            OR: [
              { observations: { contains: search } },
              { client: { name: { contains: search } } },
              { work: { name: { contains: search } } },
            ],
          }
        : {}),
    };

    const orders = await this.prisma.serviceOrder.findMany({
      where,
      include: SERVICE_ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => this.convertDecimals(order));
  }

  async findOne(companyId: string, id: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: SERVICE_ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Ordem de serviço não encontrada');
    return this.convertDecimals(order);
  }

  async update(companyId: string, id: string, dto: UpdateServiceOrderDto) {
    const existing = await this.findOne(companyId, id);

    if (dto.clientId) {
      await this.ensureClientBelongsToCompany(companyId, dto.clientId);
    }
    if (dto.workId) {
      await this.ensureWorkBelongsToCompany(companyId, dto.workId);
    }

    // Resultado financeiro: recalcula profit sempre que cost/saleValue forem informados,
    // usando o valor já gravado para o campo não enviado (evita profit inconsistente).
    const cost = dto.cost !== undefined ? dto.cost : existing.cost ?? undefined;
    const saleValue =
      dto.saleValue !== undefined ? dto.saleValue : existing.saleValue ?? undefined;
    const profit = this.calculateProfit(cost, saleValue);

    // Se há materiais para atualizar, deletar os existentes e criar novos
    return this.prisma.$transaction(async (tx) => {
      if (dto.materials) {
        await tx.serviceOrderMaterial.deleteMany({
          where: { serviceOrderId: id },
        });
      }

      const updated = await tx.serviceOrder.update({
        where: { id },
        data: {
          clientId: dto.clientId,
          workId: dto.workId,
          status: dto.status,
          scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
          completedDate: dto.completedDate ? new Date(dto.completedDate) : undefined,
          cost: dto.cost,
          saleValue: dto.saleValue,
          profit,
          observations: dto.observations,
          checklist: dto.checklist,
          materials: dto.materials
            ? {
                create: dto.materials.map((m) => ({
                  materialName: m.materialName,
                  quantity: m.quantity,
                  unit: m.unit,
                })),
              }
            : undefined,
        },
        include: SERVICE_ORDER_INCLUDE,
      });

      return this.convertDecimals(updated);
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.serviceOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** Registra o resultado final (custo × venda) e conclui a OS se ainda não estiver. */
  async registerResult(companyId: string, id: string, dto: RegisterServiceOrderResultDto) {
    const existing = await this.findOne(companyId, id);

    if (existing.status === 'CANCELADA') {
      throw new BadRequestException(
        'Não é possível registrar resultado de uma ordem de serviço cancelada',
      );
    }

    const profit = this.calculateProfit(dto.cost, dto.saleValue);

    return this.convertDecimals(
      await this.prisma.serviceOrder.update({
        where: { id },
        data: {
          cost: dto.cost,
          saleValue: dto.saleValue,
          profit,
          status: 'CONCLUIDA',
          completedDate: existing.completedDate ?? new Date(),
        },
        include: SERVICE_ORDER_INCLUDE,
      }),
    );
  }

  /** Retorna o resultado financeiro da OS: custo, venda, lucro e margem (%). */
  async getResult(companyId: string, id: string) {
    const existing = await this.findOne(companyId, id);

    const cost = existing.cost ?? null;
    const saleValue = existing.saleValue ?? null;
    const profit = existing.profit ?? null;

    // Margem sobre o valor de venda (mesma semântica do marginPct de Quote).
    const profitPct =
      profit !== null && saleValue !== null && saleValue > 0
        ? this.round2((profit / saleValue) * 100)
        : null;

    return { cost, saleValue, profit, profitPct };
  }

  /** Calcula profit = saleValue − cost quando ambos forem informados. */
  private calculateProfit(cost?: number, saleValue?: number): number | undefined {
    if (cost === undefined || saleValue === undefined) return undefined;
    return this.round2(saleValue - cost);
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private async generateCode(companyId: string): Promise<number> {
    const lastOrder = await this.prisma.serviceOrder.findFirst({
      where: { companyId },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    return (lastOrder?.code ?? 0) + 1;
  }

  private async ensureClientBelongsToCompany(companyId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new BadRequestException('Cliente inválido: não pertence à empresa ativa');
    }
  }

  private async ensureWorkBelongsToCompany(companyId: string, workId: string) {
    const work = await this.prisma.work.findFirst({
      where: { id: workId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!work) {
      throw new BadRequestException('Obra inválida: não pertence à empresa ativa');
    }
  }

  private convertDecimals(order: any) {
    return {
      ...order,
      cost: order.cost != null ? Number(order.cost) : null,
      saleValue: order.saleValue != null ? Number(order.saleValue) : null,
      profit: order.profit != null ? Number(order.profit) : null,
      materials: order.materials?.map((m: any) => ({
        ...m,
        quantity: Number(m.quantity),
      })),
    };
  }
}
