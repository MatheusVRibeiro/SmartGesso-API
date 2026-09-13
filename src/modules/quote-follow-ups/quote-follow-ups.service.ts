import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuoteFollowUpStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateQuoteFollowUpDto } from './dto/create-quote-follow-up.dto';
import { UpdateQuoteFollowUpDto } from './dto/update-quote-follow-up.dto';

/**
 * Matriz de transições de status válidas para QuoteFollowUp.
 *
 *   PENDING  → DONE | CANCELLED
 *   DONE / CANCELLED são estados terminais — não saem dele.
 */
const STATUS_TRANSITIONS: Record<
  QuoteFollowUpStatus,
  QuoteFollowUpStatus[]
> = {
  PENDING: ['DONE', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
};

/** Include leve para serialização da API (consistente com os demais módulos). */
const FOLLOW_UP_INCLUDE = {
  quote: {
    select: { id: true, quoteNumber: true, version: true },
  },
  createdBy: {
    select: { id: true, name: true },
  },
} as const;

@Injectable()
export class QuoteFollowUpsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista os follow-ups de um orçamento (tenant-scoped). */
  async listByQuote(companyId: string, quoteId: string) {
    await this.ensureQuoteBelongsToCompany(companyId, quoteId);

    const followUps = await this.prisma.quoteFollowUp.findMany({
      where: {
        companyId,
        quoteId,
        deletedAt: null,
      },
      include: FOLLOW_UP_INCLUDE,
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    });

    return followUps;
  }

  /** Cria um follow-up para um orçamento (tenant-scoped). */
  async create(
    companyId: string,
    userId: string | undefined,
    quoteId: string,
    dto: CreateQuoteFollowUpDto,
  ) {
    await this.ensureQuoteBelongsToCompany(companyId, quoteId);

    const created = await this.prisma.quoteFollowUp.create({
      data: {
        companyId,
        quoteId,
        type: dto.type,
        notes: dto.notes ?? null,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: QuoteFollowUpStatus.PENDING,
        createdById: userId ?? null,
      },
      include: FOLLOW_UP_INCLUDE,
    });

    return created;
  }

  /**
   * Atualiza campos editáveis de um follow-up (tenant-scoped).
   * Busca apenas por id + companyId — a rota PATCH /quote-follow-ups/:id é top-level.
   */
  async update(companyId: string, id: string, dto: UpdateQuoteFollowUpDto) {
    await this.findFollowUpById(companyId, id);

    const updated = await this.prisma.quoteFollowUp.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.scheduledAt !== undefined && {
          scheduledAt: new Date(dto.scheduledAt),
        }),
      },
      include: FOLLOW_UP_INCLUDE,
    });

    return updated;
  }

  /**
   * Transiciona o status do follow-up validando contra a matriz canônica.
   * - PENDING → DONE: registra doneAt.
   * - PENDING → CANCELLED: apenas muda o status.
   */
  async updateStatus(
    companyId: string,
    id: string,
    status: QuoteFollowUpStatus,
  ) {
    const existing = await this.findFollowUpById(companyId, id);

    const allowed = STATUS_TRANSITIONS[existing.status];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Transição inválida: ${existing.status} → ${status}`,
      );
    }

    const updated = await this.prisma.quoteFollowUp.update({
      where: { id },
      data: {
        status,
        ...(status === QuoteFollowUpStatus.DONE && { doneAt: new Date() }),
      },
      include: FOLLOW_UP_INCLUDE,
    });

    return updated;
  }

  /**
   * Lista os follow-ups PENDING agendados até o fim do dia de hoje.
   * Usado pela "agenda do dia" do comercial.
   */
  async listToday(companyId: string) {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const followUps = await this.prisma.quoteFollowUp.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: QuoteFollowUpStatus.PENDING,
        scheduledAt: { lte: endOfDay },
      },
      include: FOLLOW_UP_INCLUDE,
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    });

    return followUps;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Shared helpers
  // ════════════════════════════════════════════════════════════════════════════

  /** Busca um follow-up por id + companyId (tenant isolation, sem quoteId). */
  private async findFollowUpById(companyId: string, id: string) {
    const followUp = await this.prisma.quoteFollowUp.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
      include: FOLLOW_UP_INCLUDE,
    });

    if (!followUp) {
      throw new NotFoundException('Follow-up não encontrado');
    }

    return followUp;
  }

  /** Garante que o orçamento pertence ao tenant ativo. */
  private async ensureQuoteBelongsToCompany(companyId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        companyId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!quote) {
      throw new BadRequestException(
        'Orçamento inválido: não pertence à empresa ativa',
      );
    }
  }
}
