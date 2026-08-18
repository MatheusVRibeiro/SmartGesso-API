import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Material, Product, Service } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

/**
 * Catálogo da empresa: produtos, serviços e materiais.
 * Todo acesso é escopado por companyId (vindo do request autenticado, nunca do body).
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /** Filtro de busca por texto em name/description (LIKE). */
  private searchWhere(search?: string) {
    const term = search?.trim();
    if (!term) return {};
    return {
      OR: [{ name: { contains: term } }, { description: { contains: term } }],
    };
  }

  /** Converte Decimal do Prisma para number no retorno da API. */
  private toNumber(value: unknown): number | null {
    return value === null || value === undefined ? null : Number(value);
  }

  private serializeProduct(p: Product) {
    return {
      ...p,
      price: this.toNumber(p.price),
      cost: this.toNumber(p.cost),
    };
  }

  private serializeService(s: Service) {
    return {
      ...s,
      price: this.toNumber(s.price),
      cost: this.toNumber(s.cost),
    };
  }

  private serializeMaterial(m: Material) {
    return {
      ...m,
      price: this.toNumber(m.price),
      cost: this.toNumber(m.cost),
      stockQty: this.toNumber(m.stockQty),
      minStockQty: this.toNumber(m.minStockQty),
    };
  }

  private async findProductOrThrow(companyId: string, id: string) {
    const item = await this.prisma.product.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Produto não encontrado');
    return item;
  }

  private async findServiceOrThrow(companyId: string, id: string) {
    const item = await this.prisma.service.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Serviço não encontrado');
    return item;
  }

  private async findMaterialOrThrow(companyId: string, id: string) {
    const item = await this.prisma.material.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Material não encontrado');
    return item;
  }

  private assertNonEmptyUpdate(dto: object) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Nenhum campo para atualizar');
    }
  }

  // ------------------------------------------------------------------
  // Products
  // ------------------------------------------------------------------

  async createProduct(companyId: string, dto: CreateProductDto) {
    const item = await this.prisma.product.create({
      data: { companyId, ...dto },
    });
    return this.serializeProduct(item);
  }

  async listProducts(companyId: string, search?: string) {
    const items = await this.prisma.product.findMany({
      where: { companyId, deletedAt: null, ...this.searchWhere(search) },
      orderBy: { name: 'asc' },
    });
    return items.map((i) => this.serializeProduct(i));
  }

  async getProduct(companyId: string, id: string) {
    return this.serializeProduct(await this.findProductOrThrow(companyId, id));
  }

  async updateProduct(companyId: string, id: string, dto: UpdateProductDto) {
    this.assertNonEmptyUpdate(dto);
    await this.findProductOrThrow(companyId, id);
    const item = await this.prisma.product.update({ where: { id }, data: dto });
    return this.serializeProduct(item);
  }

  /** Soft delete: marca deletedAt, não remove o registro. */
  async removeProduct(companyId: string, id: string) {
    await this.findProductOrThrow(companyId, id);
    const deletedAt = new Date();
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt },
    });
    return { id, deletedAt, deleted: true };
  }

  // ------------------------------------------------------------------
  // Services
  // ------------------------------------------------------------------

  async createService(companyId: string, dto: CreateServiceDto) {
    const item = await this.prisma.service.create({
      data: { companyId, ...dto },
    });
    return this.serializeService(item);
  }

  async listServices(companyId: string, search?: string) {
    const items = await this.prisma.service.findMany({
      where: { companyId, deletedAt: null, ...this.searchWhere(search) },
      orderBy: { name: 'asc' },
    });
    return items.map((i) => this.serializeService(i));
  }

  async getService(companyId: string, id: string) {
    return this.serializeService(await this.findServiceOrThrow(companyId, id));
  }

  async updateService(companyId: string, id: string, dto: UpdateServiceDto) {
    this.assertNonEmptyUpdate(dto);
    await this.findServiceOrThrow(companyId, id);
    const item = await this.prisma.service.update({ where: { id }, data: dto });
    return this.serializeService(item);
  }

  /** Soft delete: marca deletedAt, não remove o registro. */
  async removeService(companyId: string, id: string) {
    await this.findServiceOrThrow(companyId, id);
    const deletedAt = new Date();
    await this.prisma.service.update({
      where: { id },
      data: { deletedAt },
    });
    return { id, deletedAt, deleted: true };
  }

  // ------------------------------------------------------------------
  // Materials
  // ------------------------------------------------------------------

  async createMaterial(companyId: string, dto: CreateMaterialDto) {
    const item = await this.prisma.material.create({
      data: { companyId, ...dto },
    });
    return this.serializeMaterial(item);
  }

  async listMaterials(companyId: string, search?: string) {
    const items = await this.prisma.material.findMany({
      where: { companyId, deletedAt: null, ...this.searchWhere(search) },
      orderBy: { name: 'asc' },
    });
    return items.map((i) => this.serializeMaterial(i));
  }

  async getMaterial(companyId: string, id: string) {
    return this.serializeMaterial(await this.findMaterialOrThrow(companyId, id));
  }

  async updateMaterial(companyId: string, id: string, dto: UpdateMaterialDto) {
    this.assertNonEmptyUpdate(dto);
    await this.findMaterialOrThrow(companyId, id);
    const item = await this.prisma.material.update({ where: { id }, data: dto });
    return this.serializeMaterial(item);
  }

  /** Soft delete: marca deletedAt, não remove o registro. */
  async removeMaterial(companyId: string, id: string) {
    await this.findMaterialOrThrow(companyId, id);
    const deletedAt = new Date();
    await this.prisma.material.update({
      where: { id },
      data: { deletedAt },
    });
    return { id, deletedAt, deleted: true };
  }
}