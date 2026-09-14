import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServiceReturnStatus, ServiceWarrantyStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateServiceWarrantyDto } from './dto/create-service-warranty.dto';
import { CreateServiceReturnDto } from './dto/create-service-return.dto';

/**
 * Matriz de transições de status válidas para ServiceWarranty.
 *
 *   ACTIVE → EXPIRED (período encerrado)
 *   ACTIVE → CLOSED  (encerramento manual)
 *   EXPIRED → CLOSED
 *   CLOSED é estado terminal — não sai dele.
 */
const WARRANTY_TRANSITIONS: Record<
  ServiceWarrantyStatus,
  ServiceWarrantyStatus[]
> = {
  ACTIVE: ['EXPIRED', 'CLOSED'],
  EXPIRED: ['CLOSED'],
  CLOSED: [],
};

/**
 * Matriz de transições de status válidas para ServiceReturn.
 *
 *   OPEN → RESOLVED
 *   OPEN → CLOSED
 *   RESOLVED → CLOSED
 *   CLOSED é estado terminal — não sai dele.
 */
const RETURN_TRANSITIONS: Record<
  ServiceReturnStatus,
  ServiceReturnStatus[]
> = {
  OPEN: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

/** Include leve para serialização da API (mantém consistência com service-orders). */
const WARRANTY_INCLUDE = {
  serviceOrder: { select: { id: true, code: true } },
} as const;

const RETURN_INCLUDE = {
  serviceOrder: { select: { id: true, code: true } },
  warranty: { select: { id: true, status: true } },
} as const;

@Injectable()
export class ServiceWarrantiesService {
  constructor(private readonly prisma: PrismaService) {}

  // ════════════════════════════════════════════════════════════════════════════
  // WARRANTY — Garantia de Serviço
  // ════════════════════════════════════════════════════════════════════════════

  /** Lista todas as garantias de uma ordem de serviço (tenant-scoped). */
  async listWarranties(companyId: string, serviceOrderId: string) {
    await this.ensureServiceOrderBelongsToCompany(companyId, serviceOrderId);

    const warranties = await this.prisma.serviceWarranty.findMany({
      where: {
        companyId,
        serviceOrderId,
        deletedAt: null,
      },
      include: WARRANTY_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return warranties;
  }

  /**
   * Cria uma garantia explicitamente via POST.
   * A garantia NÃO é criada automaticamente — exige warrantyDays > 0.
   * startDate = hoje; endDate = hoje + warrantyDays.
   */
  async createWarranty(
    companyId: string,
    serviceOrderId: string,
    dto: CreateServiceWarrantyDto,
  ) {
    await this.ensureServiceOrderBelongsToCompany(companyId, serviceOrderId);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + dto.warrantyDays);

    const created = await this.prisma.serviceWarranty.create({
      data: {
        companyId,
        serviceOrderId,
        startDate,
        endDate,
        notes: dto.notes,
        status: ServiceWarrantyStatus.ACTIVE,
      },
      include: WARRANTY_INCLUDE,
    });

    return created;
  }

  /** Busca uma garantia específica (tenant-scoped). */
  async findWarranty(
    companyId: string,
    serviceOrderId: string,
    id: string,
  ) {
    const warranty = await this.prisma.serviceWarranty.findFirst({
      where: {
        id,
        companyId,
        serviceOrderId,
        deletedAt: null,
      },
      include: WARRANTY_INCLUDE,
    });

    if (!warranty) {
      throw new NotFoundException('Garantia de serviço não encontrada');
    }

    return warranty;
  }

  /**
   * Transiciona o status da garantia validando contra a matriz canônica.
   * - EXPIRED: registra automaticamente quando endDate < now (pode ser disparado manualmente).
   *
   * Busca a garantia apenas por id + companyId (tenant isolation), sem exigir
   * serviceOrderId — a rota PATCH /service-warranties/:id/status é top-level.
   */
  async updateWarrantyStatus(
    companyId: string,
    id: string,
    status: ServiceWarrantyStatus,
  ) {
    const existing = await this.findWarrantyById(companyId, id);

    const allowed = WARRANTY_TRANSITIONS[existing.status];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Transição inválida: ${existing.status} → ${status}`,
      );
    }

    const data: Prisma.ServiceWarrantyUpdateInput = { status };

    const updated = await this.prisma.serviceWarranty.update({
      where: { id },
      data,
      include: WARRANTY_INCLUDE,
    });

    return updated;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RETURN — Retorno de Serviço
  // ════════════════════════════════════════════════════════════════════════════

  /** Lista todos os retornos de uma ordem de serviço (tenant-scoped). */
  async listReturns(companyId: string, serviceOrderId: string) {
    await this.ensureServiceOrderBelongsToCompany(companyId, serviceOrderId);

    const returns = await this.prisma.serviceReturn.findMany({
      where: {
        companyId,
        serviceOrderId,
        deletedAt: null,
      },
      include: RETURN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return returns;
  }

  /**
   * Cria um retorno de serviço.
   *
   * Regra de negócio: retorno só é permitido com garantia ativa OU motivo válido.
   * - Se warrantyId for informado, a garantia deve existir, pertencer ao tenant
   *   e estar com status ACTIVE.
   * - Se warrantyId NÃO for informado, o motivo (reason) deve ser válido
   *   (não vazio) — coberto pela validação do DTO.
   */
  async createReturn(
    companyId: string,
    serviceOrderId: string,
    dto: CreateServiceReturnDto,
  ) {
    await this.ensureServiceOrderBelongsToCompany(companyId, serviceOrderId);

    let warrantyId: string | null = null;

    if (dto.warrantyId) {
      // Valida que a garantia existe, pertence ao tenant e está ACTIVE
      const warranty = await this.prisma.serviceWarranty.findFirst({
        where: {
          id: dto.warrantyId,
          companyId,
          serviceOrderId,
          deletedAt: null,
        },
        select: { id: true, status: true },
      });

      if (!warranty) {
        throw new BadRequestException(
          'Garantia informada não encontrada ou não pertence a esta ordem de serviço',
        );
      }

      if (warranty.status !== ServiceWarrantyStatus.ACTIVE) {
        throw new BadRequestException(
          `Retorno só permitido com garantia ativa. Status atual: ${warranty.status}`,
        );
      }

      warrantyId = warranty.id;
    }

    // reason é obrigatório pelo DTO — garante "motivo válido" quando não há garantia
    const created = await this.prisma.serviceReturn.create({
      data: {
        companyId,
        serviceOrderId,
        warrantyId,
        reason: dto.reason,
        description: dto.description,
        status: ServiceReturnStatus.OPEN,
      },
      include: RETURN_INCLUDE,
    });

    return created;
  }

  /** Busca um retorno específico (tenant-scoped). */
  async findReturn(
    companyId: string,
    serviceOrderId: string,
    id: string,
  ) {
    const ret = await this.prisma.serviceReturn.findFirst({
      where: {
        id,
        companyId,
        serviceOrderId,
        deletedAt: null,
      },
      include: RETURN_INCLUDE,
    });

    if (!ret) {
      throw new NotFoundException('Retorno de serviço não encontrado');
    }

    return ret;
  }

  /**
   * Transiciona o status do retorno validando contra a matriz canônica.
   * - RESOLVED: registra resolvedAt.
   *
   * Busca o retorno apenas por id + companyId (tenant isolation), sem exigir
   * serviceOrderId — a rota PATCH /service-returns/:id/status é top-level.
   */
  async updateReturnStatus(
    companyId: string,
    id: string,
    status: ServiceReturnStatus,
    resolutionNote?: string,
  ) {
    const existing = await this.findReturnById(companyId, id);

    const allowed = RETURN_TRANSITIONS[existing.status];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Transição inválida: ${existing.status} → ${status}`,
      );
    }

    const data: Prisma.ServiceReturnUpdateInput = { status };

    if (status === ServiceReturnStatus.RESOLVED) {
      data.resolvedAt = new Date();
    }
    if (resolutionNote) {
      data.resolutionNote = resolutionNote;
    }

    const updated = await this.prisma.serviceReturn.update({
      where: { id },
      data,
      include: RETURN_INCLUDE,
    });

    return updated;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Shared helpers
  // ════════════════════════════════════════════════════════════════════════════

  /** Busca uma garantia por id + companyId (tenant isolation, sem serviceOrderId). */
  private async findWarrantyById(companyId: string, id: string) {
    const warranty = await this.prisma.serviceWarranty.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
      include: WARRANTY_INCLUDE,
    });

    if (!warranty) {
      throw new NotFoundException('Garantia de serviço não encontrada');
    }

    return warranty;
  }

  /** Busca um retorno por id + companyId (tenant isolation, sem serviceOrderId). */
  private async findReturnById(companyId: string, id: string) {
    const ret = await this.prisma.serviceReturn.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
      include: RETURN_INCLUDE,
    });

    if (!ret) {
      throw new NotFoundException('Retorno de serviço não encontrado');
    }

    return ret;
  }

  /** Garante que a ordem de serviço pertence ao tenant ativo. */
  private async ensureServiceOrderBelongsToCompany(
    companyId: string,
    serviceOrderId: string,
  ) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: {
        id: serviceOrderId,
        companyId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!order) {
      throw new BadRequestException(
        'Ordem de serviço inválida: não pertence à empresa ativa',
      );
    }
  }
}
