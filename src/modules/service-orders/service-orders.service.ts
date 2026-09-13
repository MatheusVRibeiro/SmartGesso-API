import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CompanySequenceService, SEQUENCE_TYPES } from '../core/services/company-sequence.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { RegisterServiceOrderResultDto } from './dto/register-service-order-result.dto';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/paginate';

const SERVICE_ORDER_INCLUDE = {
  client: { select: { id: true, name: true, phone: true } },
  work: { select: { id: true, name: true } },
  quote: { select: { id: true, quoteNumber: true, version: true } },
  materials: true,
} as const;

@Injectable()
export class ServiceOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequenceService: CompanySequenceService,
  ) {}

  async create(companyId: string, dto: CreateServiceOrderDto) {
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
          pauseReason: dto.pauseReason,
          etapas: dto.etapas,
          needsProduction: dto.needsProduction,
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
  }

  async findAll(
    companyId: string,
    pagination: PaginationDto,
    search?: string,
    status?: string,
  ): Promise<PaginatedResponseDto<any>> {
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

    const result = await paginate(
      this.prisma.serviceOrder,
      where,
      pagination,
      { createdAt: 'desc' },
      SERVICE_ORDER_INCLUDE,
    );

    // Convert decimals for all items
    result.data = result.data.map((order: any) => this.convertDecimals(order));

    return result;
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
          pauseReason: dto.pauseReason,
          etapas: dto.etapas,
          needsProduction: dto.needsProduction,
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

  /**
   * Resumo financeiro auditável da OS — fonte única para resultado.
   *
   * Todos os valores são calculados a partir de dados reais (payments e
   * expenses vinculados à OS). O campo `profit` do schema NÃO é considerado
   * confiável — é um cache que pode estar desatualizado.
   *
   * additionalApproved é 0 por enquanto (preparado para Aditivos futuros).
   */
  async getFinancialSummary(companyId: string, id: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        quote: { select: { total: true } },
      },
    });
    if (!order) throw new NotFoundException('Ordem de serviço não encontrada');

    // 1. contractedValue: saleValue da OS, com fallback para quote.total
    const contractedValue =
      order.saleValue != null
        ? Number(order.saleValue)
        : order.quote?.total != null
          ? Number(order.quote.total)
          : 0;

    // 2. additionalApproved: soma de aditivos APPROVED desta OS (ETAPA 9).
    //    Apenas aditivos aprovados entram no total contratado — DRAFT/SENT/REJECTED/CANCELLED são ignorados.
    const additionalSum = await this.prisma.serviceAdditional.aggregate({
      where: {
        serviceOrderId: id,
        companyId,
        status: 'APPROVED',
        deletedAt: null,
      },
      _sum: { amount: true },
    });
    const additionalApproved = Number(additionalSum._sum.amount ?? 0);

    // 3. totalContracted
    const totalContracted = contractedValue + additionalApproved;

    // 4. received: soma de payments CONFIRMADO vinculados à OS
    //    - Payments sem parcelas (installmentCount = 1): status CONFIRMADO → amount
    //    - Payments com parcelas: soma das parcelas CONFIRMADO
    const directPayments = await this.prisma.payment.aggregate({
      where: {
        serviceOrderId: id,
        companyId,
        deletedAt: null,
        status: 'CONFIRMADO',
        installmentCount: 1,
      },
      _sum: { amount: true },
    });

    const installmentPayments = await this.prisma.paymentInstallment.aggregate({
      where: {
        payment: {
          serviceOrderId: id,
          companyId,
          deletedAt: null,
        },
        status: 'CONFIRMADO',
      },
      _sum: { amount: true },
    });

    const received =
      Number(directPayments._sum.amount ?? 0) +
      Number(installmentPayments._sum.amount ?? 0);

    // 5. toReceive: totalContracted - received
    const toReceive = totalContracted - received;

    // 6. forecastCost: custo planejado (ServiceOrder.cost)
    const forecastCost = order.cost != null ? Number(order.cost) : 0;

    // 7. realizedCost: soma de expenses vinculados à OS
    const expensesSum = await this.prisma.expense.aggregate({
      where: {
        serviceOrderId: id,
        companyId,
        deletedAt: null,
      },
      _sum: { amount: true },
    });
    const realizedCost = Number(expensesSum._sum.amount ?? 0);

    // 8. projectedResult: totalContracted - forecastCost
    const projectedResult = totalContracted - forecastCost;

    // 9. cashResult: received - realizedCost
    const cashResult = received - realizedCost;

    // 10. margin: projectedResult / totalContracted * 100
    const margin =
      totalContracted > 0
        ? this.round2((projectedResult / totalContracted) * 100)
        : null;

    return {
      contractedValue: this.round2(contractedValue),
      additionalApproved,
      totalContracted: this.round2(totalContracted),
      received: this.round2(received),
      toReceive: this.round2(toReceive),
      forecastCost: this.round2(forecastCost),
      realizedCost: this.round2(realizedCost),
      projectedResult: this.round2(projectedResult),
      cashResult: this.round2(cashResult),
      margin,
    };
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
    return this.sequenceService.increment(companyId, SEQUENCE_TYPES.SERVICE_ORDER);
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
