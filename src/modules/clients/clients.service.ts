import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/paginate';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cria um cliente sempre scoped pela empresa do contexto (nunca do body). */
  async create(companyId: string, dto: CreateClientDto) {
    return this.prisma.client.create({
      data: {
        companyId,
        type: dto.type,
        name: dto.name,
        document: dto.document,
        email: dto.email,
        phone: dto.phone,
        whatsapp: dto.whatsapp,
        postalCode: dto.postalCode,
        street: dto.street,
        number: dto.number,
        complement: dto.complement,
        district: dto.district,
        city: dto.city,
        state: dto.state,
        observations: dto.observations,
      },
    });
  }

  /** Lista clientes não-deletados da empresa, ordenados por name asc. Suporta ?search=. */
  async findAll(
    companyId: string,
    pagination: PaginationDto,
    search?: string,
  ): Promise<PaginatedResponseDto<any>> {
    const where: Prisma.ClientWhereInput = {
      companyId,
      deletedAt: null,
    };

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term } },
        { document: { contains: term } },
        { email: { contains: term } },
      ];
    }

    return paginate(this.prisma.client, where, pagination, { name: 'asc' });
  }

  /** Busca um cliente por id, scoped pela empresa. */
  async findOne(companyId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');
    return client;
  }

  /** Atualiza um cliente existente (scoped pela empresa). */
  async update(companyId: string, id: string, dto: UpdateClientDto) {
    await this.findOne(companyId, id);
    return this.prisma.client.update({
      where: { id },
      data: {
        type: dto.type,
        name: dto.name,
        document: dto.document,
        email: dto.email,
        phone: dto.phone,
        whatsapp: dto.whatsapp,
        postalCode: dto.postalCode,
        street: dto.street,
        number: dto.number,
        complement: dto.complement,
        district: dto.district,
        city: dto.city,
        state: dto.state,
        observations: dto.observations,
      },
    });
  }

  /** Soft delete: marca deletedAt, não remove o registro. */
  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}