import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateWorkDto } from './dto/create-work.dto';
import { UpdateWorkDto } from './dto/update-work.dto';

const WORK_INCLUDE = {
  client: { select: { id: true, name: true } },
} as const;

@Injectable()
export class WorksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateWorkDto) {
    await this.ensureClientBelongsToCompany(companyId, dto.clientId);

    return this.prisma.work.create({
      data: {
        companyId,
        clientId: dto.clientId,
        name: dto.name,
        reference: dto.reference,
        postalCode: dto.postalCode,
        street: dto.street,
        number: dto.number,
        complement: dto.complement,
        district: dto.district,
        city: dto.city,
        state: dto.state,
        status: dto.status,
        observations: dto.observations,
      },
      include: WORK_INCLUDE,
    });
  }

  async findAll(companyId: string, search?: string) {
    const where: Prisma.WorkWhereInput = {
      companyId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { reference: { contains: search } },
            ],
          }
        : {}),
    };

    return this.prisma.work.findMany({
      where,
      include: WORK_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const work = await this.prisma.work.findFirst({
      where: { id, companyId, deletedAt: null },
      include: WORK_INCLUDE,
    });
    if (!work) throw new NotFoundException('Obra não encontrada');
    return work;
  }

  async update(companyId: string, id: string, dto: UpdateWorkDto) {
    await this.findOne(companyId, id);

    if (dto.clientId) {
      await this.ensureClientBelongsToCompany(companyId, dto.clientId);
    }

    return this.prisma.work.update({
      where: { id },
      data: {
        clientId: dto.clientId,
        name: dto.name,
        reference: dto.reference,
        postalCode: dto.postalCode,
        street: dto.street,
        number: dto.number,
        complement: dto.complement,
        district: dto.district,
        city: dto.city,
        state: dto.state,
        status: dto.status,
        observations: dto.observations,
      },
      include: WORK_INCLUDE,
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.work.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
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
}