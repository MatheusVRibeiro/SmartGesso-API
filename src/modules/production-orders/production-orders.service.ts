import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import { RegisterProductionDto } from './dto/register-production.dto';

const PRODUCTION_ORDER_INCLUDE = {
  items: true,
  client: { select: { id: true, name: true } },
  work: { select: { id: true, name: true } },
} as const;

@Injectable()
export class ProductionOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateProductionOrderDto) {
    // Validar clientId se fornecido
    if (dto.clientId) {
      await this.ensureClientBelongsToCompany(companyId, dto.clientId);
    }

    // Validar workId se fornecido
    if (dto.workId) {
      await this.ensureWorkBelongsToCompany(companyId, dto.workId);
    }

    // Gerar código sequencial
    const nextCode = await this.getNextCode(companyId);

    // Criar ordem com itens
    return this.prisma.productionOrder.create({
      data: {
        companyId,
        clientId: dto.clientId,
        workId: dto.workId,
        code: nextCode,
        status: dto.status || 'PENDENTE',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        responsiblePerson: dto.responsiblePerson,
        observations: dto.observations,
        items: {
          create: dto.items.map(item => ({
            productName: item.productName,
            quantity: item.quantity,
            unit: item.unit || 'un',
            producedQty: item.producedQty || 0,
            wastedQty: item.wastedQty || 0,
            status: item.status || 'PENDENTE',
          })),
        },
      },
      include: PRODUCTION_ORDER_INCLUDE,
    });
  }

  async findAll(companyId: string, search?: string, status?: string) {
    const where: Prisma.ProductionOrderWhereInput = {
      companyId,
      deletedAt: null,
      ...(status ? { status: status as any } : {}),
      ...(search
        ? {
            OR: [
              { responsiblePerson: { contains: search } },
              { observations: { contains: search } },
              { items: { some: { productName: { contains: search } } } },
            ],
          }
        : {}),
    };

    return this.prisma.productionOrder.findMany({
      where,
      include: PRODUCTION_ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: PRODUCTION_ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Ordem de produção não encontrada');
    return order;
  }

  async update(companyId: string, id: string, dto: UpdateProductionOrderDto) {
    const existing = await this.findOne(companyId, id);

    // Validar clientId se fornecido
    if (dto.clientId) {
      await this.ensureClientBelongsToCompany(companyId, dto.clientId);
    }

    // Validar workId se fornecido
    if (dto.workId) {
      await this.ensureWorkBelongsToCompany(companyId, dto.workId);
    }

    // Se completando, registrar data de conclusão
    const completedDate = dto.status === 'CONCLUIDA' 
      ? new Date() 
      : dto.completedDate 
        ? new Date(dto.completedDate) 
        : existing.completedDate;

    // Atualizar itens se fornecidos
    return this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        // Deletar itens existentes e criar novos (dentro da transação)
        await tx.productionOrderItem.deleteMany({
          where: { productionOrderId: id },
        });

        return tx.productionOrder.update({
          where: { id },
          data: {
            clientId: dto.clientId,
            workId: dto.workId,
            status: dto.status,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : existing.dueDate,
            completedDate,
            responsiblePerson: dto.responsiblePerson ?? existing.responsiblePerson,
            observations: dto.observations ?? existing.observations,
            items: {
              create: dto.items.map(item => ({
                productName: item.productName || '',
                quantity: item.quantity || 0,
                unit: item.unit || 'un',
                producedQty: item.producedQty || 0,
                wastedQty: item.wastedQty || 0,
                status: item.status || 'PENDENTE',
              })),
            },
          },
          include: PRODUCTION_ORDER_INCLUDE,
        });
      }

      // Atualizar sem modificar itens
      return tx.productionOrder.update({
        where: { id },
        data: {
          clientId: dto.clientId,
          workId: dto.workId,
          status: dto.status,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : existing.dueDate,
          completedDate,
          responsiblePerson: dto.responsiblePerson ?? existing.responsiblePerson,
          observations: dto.observations ?? existing.observations,
        },
        include: PRODUCTION_ORDER_INCLUDE,
      });
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.productionOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async registerProduction(companyId: string, itemId: string, dto: RegisterProductionDto) {
    // Buscar item e validar pertencimento à empresa
    const item = await this.prisma.productionOrderItem.findFirst({
      where: {
        id: itemId,
        productionOrder: { companyId, deletedAt: null },
      },
      include: { productionOrder: true },
    });

    if (!item) {
      throw new NotFoundException('Item de ordem de produção não encontrado');
    }

    // Atualizar quantidades
    const updatedItem = await this.prisma.productionOrderItem.update({
      where: { id: itemId },
      data: {
        producedQty: dto.producedQty,
        wastedQty: dto.wastedQty ?? item.wastedQty,
        status: dto.status || (dto.producedQty >= Number(item.quantity) ? 'CONCLUIDO' : 'EM_PRODUCAO'),
      },
    });

    // Verificar se todos os itens foram concluídos
    const allItems = await this.prisma.productionOrderItem.findMany({
      where: { productionOrderId: item.productionOrderId },
    });

    const allCompleted = allItems.every(i => 
      i.id === itemId ? updatedItem.status === 'CONCLUIDO' : i.status === 'CONCLUIDO'
    );

    // Se todos concluídos, atualizar status da ordem
    if (allCompleted) {
      await this.prisma.productionOrder.update({
        where: { id: item.productionOrderId },
        data: {
          status: 'CONCLUIDA',
          completedDate: new Date(),
        },
      });
    }

    return updatedItem;
  }

  private async getNextCode(companyId: string): Promise<number> {
    const lastOrder = await this.prisma.productionOrder.findFirst({
      where: { companyId },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    return (lastOrder?.code || 0) + 1;
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
}
