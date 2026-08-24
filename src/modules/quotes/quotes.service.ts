import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuoteStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CompanySequenceService, SEQUENCE_TYPES } from '../core/services/company-sequence.service';
import { CreateQuoteDto, QuoteItemDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/paginate';

const QUOTE_INCLUDE = {
  client: { select: { id: true, name: true } },
  work: { select: { id: true, name: true } },
  items: true,
} as const;

const SERVICE_ORDER_INCLUDE = {
  client: { select: { id: true, name: true } },
  work: { select: { id: true, name: true } },
  quote: { select: { id: true, quoteNumber: true, version: true } },
  materials: true,
} as const;

type QuoteWithRelations = Prisma.QuoteGetPayload<{
  include: typeof QUOTE_INCLUDE;
}>;

/**
 * Converte data recebida do payload em Date para o Prisma.
 * Aceita AAAA-MM-DD (formato usado pelo mobile) ou ISO completo.
 * Retorna undefined para valores vazios/nulos/inválidos.
 */
function parseDateInput(value?: string | null): Date | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequenceService: CompanySequenceService,
  ) {}

  async create(companyId: string, dto: CreateQuoteDto) {
    await this.ensureClientBelongsToCompany(companyId, dto.clientId);
    if (dto.workId) {
      await this.ensureWorkBelongsToCompany(companyId, dto.workId);
    }

    const nextQuoteNumber = await this.getNextQuoteNumber(companyId);
    const { subtotal, total } = this.calculateTotals(
      dto.items,
      dto.discount,
      dto.marginPct,
    );

    // Rascunho com campos comerciais completos (local + prazo + pagamento)
    // é promovido automaticamente para PRONTO_PARA_ENVIAR.
    const status = this.suggestStatus(dto.status ?? 'RASCUNHO', dto);

    return this.prisma.quote.create({
      data: {
        companyId,
        clientId: dto.clientId,
        workId: dto.workId,
        quoteNumber: nextQuoteNumber,
        status,
        subtotal,
        discount: dto.discount,
        marginPct: dto.marginPct,
        total,
        paymentMethod: dto.paymentMethod,
        paymentTerms: dto.paymentTerms,
        localAddress: dto.localAddress ? { ...dto.localAddress } : undefined,
        startDate: parseDateInput(dto.startDate),
        durationDays: dto.durationDays,
        endDate: parseDateInput(dto.endDate),
        deadlineDate: parseDateInput(dto.deadlineDate),
        visitDate: parseDateInput(dto.visitDate),
        measurementDate: parseDateInput(dto.measurementDate),
        warrantyDays: dto.warrantyDays,
        validUntil: parseDateInput(dto.validUntil),
        observations: dto.observations,
        items: {
          create: dto.items.map((item) => ({
            itemType: item.itemType,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
          })),
        },
        history: {
          create: { status, note: 'Orçamento criado' },
        },
      },
      include: QUOTE_INCLUDE,
    });
  }

  async findAll(
    companyId: string,
    pagination: PaginationDto,
    search?: string,
    status?: QuoteStatus,
  ): Promise<PaginatedResponseDto<any>> {
    const where: Prisma.QuoteWhereInput = {
      companyId,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { client: { name: { contains: search } } },
              { observations: { contains: search } },
            ],
          }
        : {}),
    };

    const result = await paginate(
      this.prisma.quote,
      where,
      pagination,
      { createdAt: 'desc' },
    );

    // Convert decimals for all items
    result.data = result.data.map((q: any) => ({
      ...q,
      subtotal: Number(q.subtotal),
      discount: Number(q.discount),
      marginPct: Number(q.marginPct),
      total: Number(q.total),
    }));

    return result;
  }

  async findOne(companyId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
      include: QUOTE_INCLUDE,
    });
    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    return this.convertDecimals(quote);
  }

  async update(companyId: string, id: string, dto: UpdateQuoteDto) {
    const existing = await this.findOne(companyId, id);

    // Verificar se existe uma versão mais recente (proteção do original)
    const latestVersion = await this.prisma.quote.findFirst({
      where: {
        companyId,
        quoteNumber: existing.quoteNumber,
        deletedAt: null,
      },
      orderBy: { version: 'desc' },
      select: { version: true, id: true },
    });

    if (latestVersion && latestVersion.version > existing.version) {
      throw new BadRequestException(
        `Não é possível alterar orçamento v${existing.version}: já existe versão mais recente (v${latestVersion.version})`,
      );
    }

    if (dto.clientId) {
      await this.ensureClientBelongsToCompany(companyId, dto.clientId);
    }
    if (dto.workId) {
      await this.ensureWorkBelongsToCompany(companyId, dto.workId);
    }

    const items: QuoteItemDto[] = dto.items || existing.items.map((i) => ({
      itemType: i.itemType,
      name: i.name,
      description: i.description ?? undefined,
      quantity: Number(i.quantity),
      unit: i.unit,
      unitPrice: Number(i.unitPrice),
    }));

    const discount = dto.discount ?? existing.discount;
    const marginPct = dto.marginPct ?? existing.marginPct;
    const { subtotal, total } = this.calculateTotals(items, discount, marginPct);

    const statusChanged =
      dto.status && dto.status !== existing.status ? dto.status : undefined;

    return this.prisma.$transaction(async (tx) => {
      // Se items foram enviados, substitui todos (dentro da transação)
      if (dto.items) {
        await tx.quoteItem.deleteMany({
          where: { quoteId: id },
        });
      }

      const updated = await tx.quote.update({
        where: { id },
        data: {
          clientId: dto.clientId,
          workId: dto.workId,
          status: dto.status,
          subtotal,
          discount,
          marginPct,
          total,
          paymentMethod: dto.paymentMethod,
          paymentTerms: dto.paymentTerms,
          localAddress: dto.localAddress ? { ...dto.localAddress } : undefined,
          startDate: parseDateInput(dto.startDate),
          durationDays: dto.durationDays,
          endDate: parseDateInput(dto.endDate),
          deadlineDate: parseDateInput(dto.deadlineDate),
          visitDate: parseDateInput(dto.visitDate),
          measurementDate: parseDateInput(dto.measurementDate),
          warrantyDays: dto.warrantyDays,
          validUntil: parseDateInput(dto.validUntil),
          observations: dto.observations,
          ...(dto.items
            ? {
                items: {
                  create: dto.items.map((item) => ({
                    itemType: item.itemType,
                    name: item.name,
                    description: item.description,
                    quantity: item.quantity,
                    unit: item.unit,
                    unitPrice: item.unitPrice,
                    total: item.quantity * item.unitPrice,
                  })),
                },
              }
            : {}),
        },
        include: QUOTE_INCLUDE,
      });

      if (statusChanged) {
        await tx.quoteHistory.create({
          data: {
            quoteId: id,
            status: statusChanged,
            note: `Status alterado de ${existing.status} para ${statusChanged}`,
          },
        });
      }

      return this.convertDecimals(updated);
    });
  }

  async remove(companyId: string, id: string) {
    const existing = await this.findOne(companyId, id);

    // Verificar se existe uma versão mais recente (proteção do original)
    const latestVersion = await this.prisma.quote.findFirst({
      where: {
        companyId,
        quoteNumber: existing.quoteNumber,
        deletedAt: null,
      },
      orderBy: { version: 'desc' },
      select: { version: true, id: true },
    });

    if (latestVersion && latestVersion.version > existing.version) {
      throw new BadRequestException(
        `Não é possível excluir orçamento v${existing.version}: já existe versão mais recente (v${latestVersion.version})`,
      );
    }

    return this.prisma.quote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async createVersion(companyId: string, id: string) {
    const original = await this.findOne(companyId, id);

    // Verificar se já existe uma versão mais recente (proteção contra concorrência)
    const latestVersion = await this.prisma.quote.findFirst({
      where: {
        companyId,
        quoteNumber: original.quoteNumber,
        deletedAt: null,
      },
      orderBy: { version: 'desc' },
      select: { version: true, id: true },
    });

    // Se existe uma versão mais recente que não é a original, usar ela como base
    // Isso garante que sempre criamos a próxima versão a partir da mais atual
    if (latestVersion && latestVersion.version > original.version) {
      throw new BadRequestException(
        `Já existe uma versão mais recente (v${latestVersion.version}) para este orçamento`,
      );
    }

    const nextVersion = original.version + 1;

    // Verificar se já existe esta versão (pode ter sido criada por outra requisição)
    const existingVersion = await this.prisma.quote.findFirst({
      where: {
        companyId,
        quoteNumber: original.quoteNumber,
        version: nextVersion,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingVersion) {
      throw new BadRequestException(
        `A versão ${nextVersion} já foi criada para este orçamento`,
      );
    }

    return this.prisma.quote.create({
      data: {
        companyId,
        clientId: original.clientId,
        workId: original.workId,
        quoteNumber: original.quoteNumber, // Mantém o mesmo número
        version: nextVersion,
        status: 'RASCUNHO',
        subtotal: original.subtotal,
        discount: original.discount,
        marginPct: original.marginPct,
        total: original.total,
        paymentMethod: original.paymentMethod,
        paymentTerms: original.paymentTerms,
        localAddress: original.localAddress ?? undefined,
        startDate: original.startDate,
        durationDays: original.durationDays,
        endDate: original.endDate,
        deadlineDate: original.deadlineDate,
        visitDate: original.visitDate,
        measurementDate: original.measurementDate,
        warrantyDays: original.warrantyDays,
        validUntil: original.validUntil,
        observations: original.observations,
        items: {
          create: original.items.map((item) => ({
            itemType: item.itemType,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        },
        history: {
          create: {
            status: 'RASCUNHO',
            note: `Nova versão (v${nextVersion}) do orçamento #${original.quoteNumber}`,
          },
        },
      },
      include: QUOTE_INCLUDE,
    });
  }

  /**
   * Cria ou retorna a ServiceOrder vinculada ao orçamento.
   * Função interna idempotente: se já existe OS para o quote, retorna-a.
   * Usada tanto por approve() quanto por convertToService() (deprecated).
   */
  private async ensureServiceOrderFromQuote(
    tx: any,
    companyId: string,
    quote: { id: string; clientId: string; workId: string | null; startDate: Date | null; total: any; observations: string | null },
  ) {
    // 1. Verificar se já existe ServiceOrder para este orçamento (idempotência)
    const existingOrder = await tx.serviceOrder.findFirst({
      where: { companyId, quoteId: quote.id },
      include: SERVICE_ORDER_INCLUDE,
    });
    if (existingOrder) {
      return { serviceOrder: existingOrder, created: false };
    }

    // 2. Gerar código sequencial atomicamente (Etapa 4 — numeração concorrente segura)
    const code = await this.sequenceService.increment(
      companyId,
      SEQUENCE_TYPES.SERVICE_ORDER,
      tx,
    );

    // 3. Criar a ServiceOrder
    const serviceOrder = await tx.serviceOrder.create({
      data: {
        companyId,
        clientId: quote.clientId,
        workId: quote.workId ?? undefined,
        quoteId: quote.id,
        code,
        status: 'PENDENTE',
        scheduledDate: quote.startDate ? new Date(quote.startDate) : undefined,
        saleValue: Number(quote.total),
        observations: quote.observations ?? undefined,
      },
      include: SERVICE_ORDER_INCLUDE,
    });

    // 4. Marcar orçamento como convertido
    await tx.quote.update({
      where: { id: quote.id },
      data: { convertedAt: new Date() },
    });

    return { serviceOrder, created: true };
  }

  /** Aprova o orçamento: status APROVADO + registro de histórico + criação idempotente de OS. */
  async approve(companyId: string, id: string) {
    const quote = await this.findOne(companyId, id);

    if (quote.status === 'CANCELADO') {
      throw new BadRequestException(
        'Orçamento cancelado não pode ser aprovado',
      );
    }

    // Se já está APROVADO, retorna sem duplicar histórico
    const alreadyApproved = quote.status === 'APROVADO';

    return this.prisma.$transaction(async (tx) => {
      let updated: QuoteWithRelations;

      if (!alreadyApproved) {
        updated = await tx.quote.update({
          where: { id },
          data: { status: 'APROVADO' },
          include: QUOTE_INCLUDE,
        });
        await tx.quoteHistory.create({
          data: { quoteId: id, status: 'APROVADO', note: 'Orçamento aprovado' },
        });
      } else {
        // quote já está no formato correto (convertDecimals aplicado por findOne)
        updated = quote as unknown as QuoteWithRelations;
      }

      // Criar ou retornar ServiceOrder existente (idempotente)
      const { serviceOrder, created: serviceOrderCreated } =
        await this.ensureServiceOrderFromQuote(tx, companyId, {
          id: updated.id,
          clientId: updated.clientId,
          workId: updated.workId,
          startDate: updated.startDate,
          total: updated.total,
          observations: updated.observations,
        });

      return {
        quote: this.convertDecimals(updated),
        serviceOrder: this.convertServiceOrderDecimals(serviceOrder),
        serviceOrderCreated,
      };
    });
  }

  /** Rejeita o orçamento: status REJEITADO + registro de histórico. */
  async reject(companyId: string, id: string, note?: string) {
    const quote = await this.findOne(companyId, id);

    if (quote.status === 'REJEITADO') {
      return quote;
    }
    if (quote.status === 'CANCELADO') {
      throw new BadRequestException(
        'Orçamento cancelado não pode ser rejeitado',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.quote.update({
        where: { id },
        data: { status: 'REJEITADO' },
        include: QUOTE_INCLUDE,
      });
      await tx.quoteHistory.create({
        data: {
          quoteId: id,
          status: 'REJEITADO',
          note: note ?? 'Orçamento não aprovado',
        },
      });
      return this.convertDecimals(updated);
    });
  }

  /** Duplica o orçamento: novo quoteNumber, status RASCUNHO, copia itens/local/prazo. */
  async duplicate(companyId: string, id: string) {
    const original = await this.findOne(companyId, id);

    const nextQuoteNumber = await this.getNextQuoteNumber(companyId);

    return this.prisma.quote.create({
      data: {
        companyId,
        clientId: original.clientId,
        workId: original.workId,
        quoteNumber: nextQuoteNumber,
        version: 1,
        status: 'RASCUNHO',
        subtotal: original.subtotal,
        discount: original.discount,
        marginPct: original.marginPct,
        total: original.total,
        paymentMethod: original.paymentMethod,
        paymentTerms: original.paymentTerms,
        localAddress: original.localAddress ?? undefined,
        startDate: original.startDate,
        durationDays: original.durationDays,
        endDate: original.endDate,
        deadlineDate: original.deadlineDate,
        visitDate: original.visitDate,
        measurementDate: original.measurementDate,
        warrantyDays: original.warrantyDays,
        validUntil: original.validUntil,
        observations: original.observations,
        items: {
          create: original.items.map((item) => ({
            itemType: item.itemType,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        },
        history: {
          create: {
            status: 'RASCUNHO',
            note: `Duplicado do orçamento #${original.quoteNumber}`,
          },
        },
      },
      include: QUOTE_INCLUDE,
    });
  }

  /**
   * Converte um orçamento APROVADO em ordem de serviço.
   * @deprecated Use POST /quotes/:id/approve (idempotente). Este endpoint será
   * removido em versão futura. Mantido temporariamente para compatibilidade.
   */
  async convertToService(companyId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
      include: QUOTE_INCLUDE,
    });
    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    if (quote.status !== 'APROVADO') {
      throw new BadRequestException(
        'Somente orçamentos aprovados podem ser convertidos em serviço',
      );
    }

    const { serviceOrder, created } = await this.prisma.$transaction(
      async (tx) => {
        return this.ensureServiceOrderFromQuote(tx, companyId, {
          id: quote.id,
          clientId: quote.clientId,
          workId: quote.workId,
          startDate: quote.startDate,
          total: quote.total,
          observations: quote.observations,
        });
      },
    );

    return {
      serviceOrderId: serviceOrder.id,
      ...this.convertServiceOrderDecimals(serviceOrder),
      created,
    };
  }

  /**
   * Rascunho com campos comerciais completos (local + prazo + forma de
   * pagamento) é promovido para PRONTO_PARA_ENVIAR.
   */
  private suggestStatus(
    requested: QuoteStatus,
    dto: CreateQuoteDto,
  ): QuoteStatus {
    if (requested !== 'RASCUNHO') return requested;

    const hasLocal = !!dto.localAddress;
    const hasPrazo = !!(
      dto.startDate ||
      dto.endDate ||
      dto.deadlineDate ||
      dto.durationDays
    );
    const hasPayment = !!dto.paymentTerms;

    return hasLocal && hasPrazo && hasPayment
      ? 'PRONTO_PARA_ENVIAR'
      : 'RASCUNHO';
  }

  private calculateTotals(
    items: QuoteItemDto[],
    discount: number,
    marginPct: number,
  ) {
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const total = subtotal - discount + subtotal * (marginPct / 100);
    return { subtotal, total };
  }

  private async getNextQuoteNumber(companyId: string): Promise<number> {
    return this.sequenceService.increment(companyId, SEQUENCE_TYPES.QUOTE);
  }

  private convertDecimals(quote: QuoteWithRelations) {
    return {
      ...quote,
      subtotal: Number(quote.subtotal),
      discount: Number(quote.discount),
      marginPct: Number(quote.marginPct),
      total: Number(quote.total),
      items: quote.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
    };
  }

  /** Converte Decimals da OS criada na conversão (cost/saleValue/profit). */
  private convertServiceOrderDecimals(order: any) {
    return {
      ...order,
      cost: order.cost != null ? Number(order.cost) : null,
      saleValue: order.saleValue != null ? Number(order.saleValue) : null,
      profit: order.profit != null ? Number(order.profit) : null,
      materials: order.materials?.map((m: any) => ({
        ...m,
        quantity: Number(m.quantity),
      })),
    };
  }

  private async ensureClientBelongsToCompany(
    companyId: string,
    clientId: string,
  ) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new BadRequestException(
        'Cliente inválido: não pertence à empresa ativa',
      );
    }
  }

  private async ensureWorkBelongsToCompany(
    companyId: string,
    workId: string,
  ) {
    const work = await this.prisma.work.findFirst({
      where: { id: workId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!work) {
      throw new BadRequestException(
        'Obra inválida: não pertence à empresa ativa',
      );
    }
  }
}