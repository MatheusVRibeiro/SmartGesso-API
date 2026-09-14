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
 * Materiais pré-cadastrados padrão para novas empresas (gesso e drywall).
 */
export const DEFAULT_CATALOG_MATERIALS = [
  {
    name: 'Placa de Gesso ST 12.5mm',
    description: 'Placa de drywall standard para forros e paredes internas',
    unit: 'un',
    price: 38.5,
    cost: 28.0,
    stockQty: 0,
    minStockQty: 10,
  },
  {
    name: 'Placa de Gesso RU 12.5mm (Verde)',
    description: 'Placa de drywall resistente à umidade para banheiros e cozinhas',
    unit: 'un',
    price: 49.9,
    cost: 36.5,
    stockQty: 0,
    minStockQty: 5,
  },
  {
    name: 'Perfil F530 (Canaleta)',
    description: 'Perfil canaleta F530 galvanizado para estrutura de forro drywall',
    unit: 'm',
    price: 8.5,
    cost: 5.8,
    stockQty: 0,
    minStockQty: 20,
  },
  {
    name: 'Guia 48mm',
    description: 'Guia U metálica galvanizada de 48mm para paredes drywall',
    unit: 'm',
    price: 6.2,
    cost: 4.1,
    stockQty: 0,
    minStockQty: 20,
  },
  {
    name: 'Montante 48mm',
    description: 'Montante C metálico galvanizado de 48mm para paredes drywall',
    unit: 'm',
    price: 7.9,
    cost: 5.2,
    stockQty: 0,
    minStockQty: 20,
  },
  {
    name: 'Parafuso GN 25 (Ponta Agulha)',
    description: 'Parafuso fosfatizado 3.5x25mm para fixação de placas drywall',
    unit: 'un',
    price: 0.15,
    cost: 0.08,
    stockQty: 0,
    minStockQty: 500,
  },
  {
    name: 'Fita Microperfurada de Papel',
    description: 'Fita de papel microperfurada para tratamento de juntas de drywall',
    unit: 'm',
    price: 0.8,
    cost: 0.4,
    stockQty: 0,
    minStockQty: 50,
  },
  {
    name: 'Massa para Junta Drywall',
    description: 'Massa pronta para acabamento e tratamento de juntas de drywall',
    unit: 'kg',
    price: 5.5,
    cost: 3.2,
    stockQty: 0,
    minStockQty: 25,
  },
  {
    name: 'Gesso em Pó (Lento/Rápido)',
    description: 'Gesso em pó para fundição, revestimentos e chumbamento',
    unit: 'kg',
    price: 1.8,
    cost: 0.9,
    stockQty: 0,
    minStockQty: 40,
  },
  {
    name: 'Regulador / Pendural F530',
    description: 'Peça de fixação e regulagem de altura para perfil F530',
    unit: 'un',
    price: 2.2,
    cost: 1.3,
    stockQty: 0,
    minStockQty: 50,
  },
] as const;

/**
 * Serviços pré-cadastrados padrão para novas empresas (mão de obra gesso e drywall).
 */
export const DEFAULT_CATALOG_SERVICES = [
  {
    name: 'Instalação de Forro Drywall',
    description: 'Mão de obra completa para instalação e acabamento de forro drywall',
    unit: 'm²',
    price: 45.0,
    cost: 25.0,
  },
  {
    name: 'Instalação de Parede Drywall',
    description: 'Mão de obra completa para montagem de divisória drywall simples',
    unit: 'm²',
    price: 55.0,
    cost: 30.0,
  },
  {
    name: 'Confecção de Sanca Aberta/Fechada',
    description: 'Mão de obra especializada para confecção de sanca decorativa',
    unit: 'm',
    price: 50.0,
    cost: 25.0,
  },
  {
    name: 'Forro Gesso Plaquinha 60x60',
    description: 'Instalação de forro de plaquinha com arame e chumbamento com gesso',
    unit: 'm²',
    price: 38.0,
    cost: 20.0,
  },
  {
    name: 'Pintura e Emassamento sobre Drywall',
    description: 'Aplicação de fundo preparador e 2 demãos de tinta látex acrílica',
    unit: 'm²',
    price: 28.0,
    cost: 14.0,
  },
] as const;

/**
 * Catálogo da empresa: produtos, serviços e materiais.
 * Todo acesso é escopado por companyId (vindo do request autenticado, nunca do body).
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------
  // Helpers & Auto-seed
  // ------------------------------------------------------------------

  /** Seed idempotente: cria materiais padrão se a empresa ainda não tiver nenhum material no catálogo. */
  async ensureDefaultMaterials(companyId: string): Promise<number> {
    const count = await this.prisma.material.count({ where: { companyId } });
    if (count > 0) return 0;

    const result = await this.prisma.material.createMany({
      data: DEFAULT_CATALOG_MATERIALS.map((m) => ({
        companyId,
        name: m.name,
        description: m.description,
        unit: m.unit,
        price: m.price,
        cost: m.cost,
        stockQty: m.stockQty,
        minStockQty: m.minStockQty,
      })),
    });
    return result.count;
  }

  /** Seed idempotente: cria serviços padrão se a empresa ainda não tiver nenhum serviço no catálogo. */
  async ensureDefaultServices(companyId: string): Promise<number> {
    const count = await this.prisma.service.count({ where: { companyId } });
    if (count > 0) return 0;

    const result = await this.prisma.service.createMany({
      data: DEFAULT_CATALOG_SERVICES.map((s) => ({
        companyId,
        name: s.name,
        description: s.description,
        unit: s.unit,
        price: s.price,
        cost: s.cost,
      })),
    });
    return result.count;
  }

  /** Rota/método para inicializar o catálogo com materiais e serviços padrão caso estejam vazios. */
  async seedDefaults(companyId: string) {
    const materialsAdded = await this.ensureDefaultMaterials(companyId);
    const servicesAdded = await this.ensureDefaultServices(companyId);
    return {
      success: true,
      materialsAdded,
      servicesAdded,
    };
  }

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
    await this.ensureDefaultServices(companyId);
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
    await this.ensureDefaultMaterials(companyId);
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