import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServiceAdditionalStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CompanySequenceService,
  SEQUENCE_TYPES,
} from '../core/services/company-sequence.service';
import { CreateServiceAdditionalDto } from './dto/create-service-additional.dto';
import { UpdateServiceAdditionalDto } from './dto/update-service-additional.dto';

/**
 * Inclui relacionamentos leves para serialização da API.
 * Mantém o mesmo estilo do SERVICE_ORDER_INCLUDE do service-orders.
 */
const ADDITIONAL_INCLUDE = {
  serviceOrder: { select: { id: true, code: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

/**
 * Matriz de transições de status válidas.
 *
 * Fluxo canônico:
 *   DRAFT → SENT → APPROVED / REJECTED
 *                 ↓
 *              CANCELLED (a qualquer momento, exceto estados terminais)
 *
 * REJECTED e CANCELLED são estados terminais — não saem deles.
 */
const STATUS_TRANSITIONS: Record<
  ServiceAdditionalStatus,
  ServiceAdditionalStatus[]
> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['CANCELLED'],
  REJECTED: [],
  CANCELLED: [],
};

@Injectable()
export class ServiceAdditionalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequenceService: CompanySequenceService,
  ) {}

  /** Lista todos os aditivos de uma ordem de serviço (tenant-scoped). */
  async list(companyId: string, serviceOrderId: string) {
    await this.ensureServiceOrderBelongsToCompany(companyId, serviceOrderId);

    const additionals = await this.prisma.serviceAdditional.findMany({
      where: { companyId, serviceOrderId, deletedAt: null },
      include: ADDITIONAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return additionals.map((a) => this.convertDecimals(a));
  }

  /**
   * Cria um novo aditivo numerado atomicamente via CompanySequenceService.
   * O código é único por tenant (SEQUENCE_TYPES.SERVICE_ADDITIONAL).
   */
  async create(
    companyId: string,
    serviceOrderId: string,
    dto: CreateServiceAdditionalDto,
    userId?: string,
  ) {
    await this.ensureServiceOrderBelongsToCompany(companyId, serviceOrderId);

    const code = await this.sequenceService.increment(
      companyId,
      SEQUENCE_TYPES.SERVICE_ADDITIONAL,
    );

    const created = await this.prisma.serviceAdditional.create({
      data: {
        companyId,
        serviceOrderId,
        code,
        description: dto.description,
        amount: dto.amount,
        estimatedCost: dto.estimatedCost,
        notes: dto.notes,
        createdById: userId,
      },
      include: ADDITIONAL_INCLUDE,
    });

    return this.convertDecimals(created);
  }

  /**
   * Atualiza um aditivo. Apenas aditivos em DRAFT podem ser editados —
   * estados enviados ou aprovados são imutáveis para preservar a auditoria.
   */
  async update(
    companyId: string,
    serviceOrderId: string,
    id: string,
    dto: UpdateServiceAdditionalDto,
  ) {
    const existing = await this.findOne(companyId, serviceOrderId, id);

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Apenas aditivos em DRAFT podem ser editados',
      );
    }

    const updated = await this.prisma.serviceAdditional.update({
      where: { id },
      data: {
        description: dto.description,
        amount: dto.amount,
        estimatedCost: dto.estimatedCost,
        notes: dto.notes,
      },
      include: ADDITIONAL_INCLUDE,
    });

    return this.convertDecimals(updated);
  }

  /**
   * Transiciona o status do aditivo validando contra a matriz canônica.
   *
   * - APPROVED: registra approvedAt (o valor passa a compor additionalApproved
   *   no financial-summary da OS, calculado on-the-fly).
   * - REJECTED: registra rejectedAt.
   * - CANCELLED a partir de APPROVED: o valor deixa de compor additionalApproved
   *   automaticamente (o summary soma apenas APPROVED).
   */
  async updateStatus(
    companyId: string,
    serviceOrderId: string,
    id: string,
    status: ServiceAdditionalStatus,
    _note?: string,
  ) {
    const existing = await this.findOne(companyId, serviceOrderId, id);

    const allowed = STATUS_TRANSITIONS[existing.status as ServiceAdditionalStatus];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Transição inválida: ${existing.status} → ${status}`,
      );
    }

    const data: Prisma.ServiceAdditionalUpdateInput = { status };

    if (status === 'APPROVED') {
      data.approvedAt = new Date();
    }
    if (status === 'REJECTED') {
      data.rejectedAt = new Date();
    }

    const updated = await this.prisma.serviceAdditional.update({
      where: { id },
      data,
      include: ADDITIONAL_INCLUDE,
    });

    return this.convertDecimals(updated);
  }

  /** Busca um aditivo específico (tenant + serviceOrder scoped). */
  async findOne(
    companyId: string,
    serviceOrderId: string,
    id: string,
  ) {
    const additional = await this.prisma.serviceAdditional.findFirst({
      where: { id, companyId, serviceOrderId, deletedAt: null },
      include: ADDITIONAL_INCLUDE,
    });

    if (!additional) {
      throw new NotFoundException('Aditivo de serviço não encontrado');
    }

    return this.convertDecimals(additional);
  }

  /** Garante que a ordem de serviço pertence ao tenant ativo. */
  private async ensureServiceOrderBelongsToCompany(
    companyId: string,
    serviceOrderId: string,
  ) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!order) {
      throw new BadRequestException(
        'Ordem de serviço inválida: não pertence à empresa ativa',
      );
    }
  }

  /** Converte Decimal do Prisma para number (mesmo padrão do service-orders). */
  private convertDecimals(additional: any) {
    return {
      ...additional,
      amount: Number(additional.amount),
      estimatedCost:
        additional.estimatedCost != null
          ? Number(additional.estimatedCost)
          : null,
    };
  }
}
