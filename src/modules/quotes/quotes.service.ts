import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateQuoteDto, QuoteItemDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

const QUOTE_INCLUDE = {
  client: { select: { id: true, name: true } },
  work: { select: { id: true, name: true } },
  items: true,
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

    return this.prisma.quote.create({
      data: {
        companyId,
        clientId: dto.clientId,
        workId: dto.workId,
        quoteNumber: nextQuoteNumber,
        status: dto.status,
        subtotal,
        discount: dto.discount,
        marginPct: dto.marginPct,
        total,
        paymentMethod: dto.paymentMethod,
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
      },
      include: QUOTE_INCLUDE,
    });
  }

  async findAll(companyId: string, search?: string) {
    const where: Prisma.QuoteWhereInput = {
      companyId,
      deletedAt: null,
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

    return this.prisma.quote.update({
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
      },
      include: QUOTE_INCLUDE,
    });
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
