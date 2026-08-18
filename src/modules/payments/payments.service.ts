import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

const PAYMENT_INCLUDE = {
  client: { select: { id: true, name: true } },
} as const;

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreatePaymentDto) {
    try {
      await this.ensureClientBelongsToCompany(companyId, dto.clientId);
      if (dto.quoteId) {
        await this.ensureQuoteBelongsToCompany(companyId, dto.quoteId);
      }

      const payment = await this.prisma.payment.create({
        data: {
          companyId,
          clientId: dto.clientId,
          quoteId: dto.quoteId,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          status: dto.status,
          notes: dto.notes,
          receiptUrl: dto.receiptUrl,
        },
        include: PAYMENT_INCLUDE,
      });

      return this.convertDecimals(payment);
    } catch (error) {
      console.error('PAYMENT CREATE ERROR:', error);
      throw error;
    }
  }

  async findAll(companyId: string, status?: string) {
    const where: Prisma.PaymentWhereInput = {
      companyId,
      deletedAt: null,
      ...(status ? { status: status as any } : {}),
    };

    const payments = await this.prisma.payment.findMany({
      where,
      include: PAYMENT_INCLUDE,
      orderBy: { paymentDate: 'desc' },
    });

    return payments.map((payment) => this.convertDecimals(payment));
  }

  async findOne(companyId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, companyId, deletedAt: null },
      include: PAYMENT_INCLUDE,
    });
    if (!payment) throw new NotFoundException('Recebimento não encontrado');
    return this.convertDecimals(payment);
  }

  async update(companyId: string, id: string, dto: UpdatePaymentDto) {
    await this.findOne(companyId, id);

    if (dto.clientId) {
      await this.ensureClientBelongsToCompany(companyId, dto.clientId);
    }
    if (dto.quoteId) {
      await this.ensureQuoteBelongsToCompany(companyId, dto.quoteId);
    }

    const payment = await this.prisma.payment.update({
      where: { id },
      data: {
        clientId: dto.clientId,
        quoteId: dto.quoteId,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status,
        notes: dto.notes,
        receiptUrl: dto.receiptUrl,
      },
      include: PAYMENT_INCLUDE,
    });

    return this.convertDecimals(payment);
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.payment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async ensureClientBelongsToCompany(companyId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new BadRequestException('Cliente inválido: não pertence à empresa ativa');
    }
  }

  private async ensureQuoteBelongsToCompany(companyId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!quote) {
      throw new BadRequestException('Orçamento inválido: não pertence à empresa ativa');
    }
  }

  private convertDecimals(payment: any) {
    return {
      ...payment,
      amount: Number(payment.amount),
    };
  }
}
