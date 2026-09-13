import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto';

/**
 * Fornecedores da empresa (ETAPA 10 — Fornecedores e Compras).
 * Todo acesso é escopado por companyId (vindo do request autenticado, nunca do body).
 */
@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cria um fornecedor sempre scoped pela empresa do contexto. */
  async create(companyId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        companyId,
        name: dto.name,
        cnpjCpf: dto.cnpjCpf,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        notes: dto.notes,
      },
    });
  }

  /** Lista fornecedores não-deletados da empresa, ordenados por name asc. Suporta ?search=. */
  async findAll(companyId: string, search?: string) {
    const where: Prisma.SupplierWhereInput = {
      companyId,
      deletedAt: null,
    };

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term } },
        { cnpjCpf: { contains: term } },
        { email: { contains: term } },
      ];
    }

    return this.prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  /** Busca um fornecedor por id, scoped pela empresa. */
  async findOne(companyId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException('Fornecedor não encontrado');
    return supplier;
  }

  /** Atualiza um fornecedor existente (scoped pela empresa). */
  async update(companyId: string, id: string, dto: UpdateSupplierDto) {
    await this.findOne(companyId, id);
    return this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name,
        cnpjCpf: dto.cnpjCpf,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        notes: dto.notes,
      },
    });
  }

  /** Soft delete: marca deletedAt, não remove o registro. */
  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
