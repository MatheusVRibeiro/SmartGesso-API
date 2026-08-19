import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuoteStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateQuoteDto, QuoteItemDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

const QUOTE_INCLUDE = {
  client: { select: { id: true, name: true } },
  work: { select: { id: true, name: true } },
  items: true,
} as const;

const SERVICE_ORDER_INCLUDE = {
  client: { select: { id: true, name: true } },
  work: { select: { id: true, name: true } },
  materials: true,
} as const;

type QuoteWithRelations = Prisma.QuoteGetPayload<{
  include: typeof QUOTE_INCLUDE;
}>;

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

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
        startDate: dto.startDate,
        durationDays: dto.durationDays,
        endDate: dto.endDate,
        deadlineDate: dto.deadlineDate,
        visitDate: dto.visitDate,
        measurementDate: dto.measurementDate,
        warrantyDays: dto.warrantyDays,
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

  async findAll(companyId: string, search?: string, status?: QuoteStatus) {
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

    const quotes = await this.prisma.quote.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        work: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return quotes.map((q) => ({
      ...q,
      subtotal: Number(q.subtotal),
      discount: Number(q.discount),
      marginPct: Number(q.marginPct),
      total: Number(q.total),
    }));
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

    if (dto.clientId) {
      await this.ensureClientBelongsToCompany(companyId, dto.clientId);
    }
    if (dto.workId) {
      await this.ensureWorkBelongsToCompany(companyId, dto.workId);
    }

    // Se items foram enviados, substitui todos
    if (dto.items) {
      await this.prisma.quoteItem.deleteMany({
        where: { quoteId: id },
      });
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
          startDate: dto.startDate,
          durationDays: dto.durationDays,
          endDate: dto.endDate,
          deadlineDate: dto.deadlineDate,
          visitDate: dto.visitDate,
          measurementDate: dto.measurementDate,
          warrantyDays: dto.warrantyDays,
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
    await this.findOne(companyId, id);
    return this.prisma.quote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async createVersion(companyId: string, id: string) {
    const original = await this.findOne(companyId, id);

    const nextQuoteNumber = await this.getNextQuoteNumber(companyId);
    const nextVersion = original.version + 1;

    return this.prisma.quote.create({
      data: {
        companyId,
        clientId: original.clientId,
        workId: original.workId,
        quoteNumber: nextQuoteNumber,
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

  /** Aprova o orçamento: status APROVADO + registro de histórico. */
  async approve(companyId: string, id: string) {
    const quote = await this.findOne(companyId, id);

    if (quote.status === 'APROVADO') {
      return quote;
    }
    if (quote.status === 'CANCELADO') {
      throw new BadRequestException(
        'Orçamento cancelado não pode ser aprovado',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.quote.update({
        where: { id },
        data: { status: 'APROVADO' },
        include: QUOTE_INCLUDE,
      });
      await tx.quoteHistory.create({
        data: { quoteId: id, status: 'APROVADO', note: 'Orçamento aprovado' },
      });
      return this.convertDecimals(updated);
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
   * Converte um orçamento APROVADO em ordem de serviço, reaproveitando
   * cliente, obra, observações, prazo (startDate) e valor total do orçamento.
   * Marca o orçamento como convertido (convertedAt) — 409 se já convertido.
   */
  async convertToService(companyId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
      include: QUOTE_INCLUDE,
    });
    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    if (quote.convertedAt) {
      throw new ConflictException('Orçamento já convertido em serviço');
    }
    if (quote.status !== 'APROVADO') {
      throw new BadRequestException(
        'Somente orçamentos aprovados podem ser convertidos em serviço',
      );
    }

    const serviceOrder = await this.prisma.$transaction(async (tx) => {
      const lastOrder = await tx.serviceOrder.findFirst({
        where: { companyId },
        orderBy: { code: 'desc' },
        select: { code: true },
      });
      const code = (lastOrder?.code ?? 0) + 1;

      const created = await tx.serviceOrder.create({
        data: {
          companyId,
          clientId: quote.clientId,
          workId: quote.workId ?? undefined,
          code,
          status: 'PENDENTE',
          scheduledDate: quote.startDate
            ? new Date(quote.startDate)
            : undefined,
          saleValue: Number(quote.total),
          observations: quote.observations ?? undefined,
        },
        include: SERVICE_ORDER_INCLUDE,
      });

      // Marca como convertido de forma atômica (evita conversão dupla em corrida).
      const marked = await tx.quote.updateMany({
        where: { id: quote.id, convertedAt: null },
        data: { convertedAt: new Date() },
      });
      if (marked.count === 0) {
        throw new ConflictException('Orçamento já convertido em serviço');
      }

      return created;
    });

    return {
      serviceOrderId: serviceOrder.id,
      ...this.convertServiceOrderDecimals(serviceOrder),
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
    const lastQuote = await this.prisma.quote.findFirst({
      where: { companyId },
      orderBy: { quoteNumber: 'desc' },
      select: { quoteNumber: true },
    });
    return (lastQuote?.quoteNumber ?? 0) + 1;
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