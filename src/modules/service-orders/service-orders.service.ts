import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';

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

      return await this.prisma.serviceOrder.create({
        data: {
          companyId,
          clientId: dto.clientId,
          workId: dto.workId,
          code,
          status: dto.status,
          scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
          completedDate: dto.completedDate ? new Date(dto.completedDate) : undefined,
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
    await this.findOne(companyId, id);

    if (dto.clientId) {
      await this.ensureClientBelongsToCompany(companyId, dto.clientId);
    }
    if (dto.workId) {
      await this.ensureWorkBelongsToCompany(companyId, dto.workId);
    }

    // Se há materiais para atualizar, deletar os existentes e criar novos
    if (dto.materials) {
      await this.prisma.serviceOrderMaterial.deleteMany({
        where: { serviceOrderId: id },
      });
    }

    return this.prisma.serviceOrder.update({
      where: { id },
      data: {
        clientId: dto.clientId,
        workId: dto.workId,
        status: dto.status,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
        completedDate: dto.completedDate ? new Date(dto.completedDate) : undefined,
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
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.serviceOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
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
      materials: order.materials?.map((m: any) => ({
        ...m,
        quantity: Number(m.quantity),
      })),
    };
  }
}
