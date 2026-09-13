import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { formatCurrency } from '../../common/utils/format-currency';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../notifications/push.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

const PAYMENT_INCLUDE = {
  client: { select: { id: true, name: true } },
  serviceOrder: { select: { id: true, code: true, clientId: true } },
  installments: {
    select: {
      id: true,
      installmentNumber: true,
      amount: true,
      dueDate: true,
      paidDate: true,
      status: true,
    },
    orderBy: { installmentNumber: 'asc' as const },
  },
} as const;

const MAX_INSTALLMENTS = 12;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService,
  ) {}

  async create(companyId: string, dto: CreatePaymentDto) {
    await this.ensureClientBelongsToCompany(companyId, dto.clientId);
    if (dto.quoteId) {
      await this.ensureQuoteBelongsToCompany(companyId, dto.quoteId);
    }
    let serviceOrder: { id: string; clientId: string } | null = null;
    if (dto.serviceOrderId) {
      serviceOrder = await this.ensureServiceOrderBelongsToCompany(
        companyId,
        dto.serviceOrderId,
      );
    }
    if (serviceOrder && serviceOrder.clientId !== dto.clientId) {
      throw new BadRequestException(
        'O cliente do pagamento deve corresponder ao cliente da ordem de serviço',
      );
    }

    const installmentCount = dto.installments?.length ?? dto.installmentCount ?? 1;
    if (installmentCount > MAX_INSTALLMENTS) {
      throw new BadRequestException(`Máximo de ${MAX_INSTALLMENTS} parcelas por recebimento`);
    }
    if (dto.installments && dto.installmentCount && dto.installments.length !== dto.installmentCount) {
      throw new BadRequestException('A quantidade de parcelas informada não confere com installmentCount');
    }

    const paymentData: Prisma.PaymentCreateInput = {
      company: { connect: { id: companyId } },
      client: { connect: { id: dto.clientId } },
      ...(dto.quoteId ? { quote: { connect: { id: dto.quoteId } } } : {}),
      ...(dto.serviceOrderId
        ? { serviceOrder: { connect: { id: dto.serviceOrderId } } }
        : {}),
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      status: installmentCount > 1 ? 'PENDENTE' : dto.status,
      notes: dto.notes,
      receiptUrl: dto.receiptUrl,
      installmentCount,
    };

    if (installmentCount > 1) {
      const installments = this.buildInstallments(companyId, dto, installmentCount);
      paymentData.installments = { create: installments };
    }

    const payment = await this.prisma.payment.create({
      data: paymentData,
      include: PAYMENT_INCLUDE,
    });

    return this.convertDecimals(payment);
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
    const existing = await this.findOne(companyId, id);

    if (dto.clientId) {
      await this.ensureClientBelongsToCompany(companyId, dto.clientId);
    }
    if (dto.quoteId) {
      await this.ensureQuoteBelongsToCompany(companyId, dto.quoteId);
    }

    // Valida a combinação EFETIVA cliente ↔ ordem de serviço: o update pode
    // mudar só o clientId (mantendo a OS vinculada), só a OS ou ambos —
    // todos os casos devem permanecer coerentes com o cliente da OS.
    const effectiveClientId = dto.clientId ?? existing.clientId;
    const effectiveServiceOrderId = dto.serviceOrderId ?? existing.serviceOrderId;
    if ((dto.clientId || dto.serviceOrderId) && effectiveClientId && effectiveServiceOrderId) {
      const serviceOrder = await this.ensureServiceOrderBelongsToCompany(
        companyId,
        effectiveServiceOrderId,
      );
      if (serviceOrder.clientId !== effectiveClientId) {
        throw new BadRequestException(
          'O cliente do pagamento deve corresponder ao cliente da ordem de serviço',
        );
      }
    }

    const payment = await this.prisma.payment.update({
      where: { id },
      data: {
        clientId: dto.clientId,
        quoteId: dto.quoteId,
        serviceOrderId: dto.serviceOrderId,
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

  /** Marca uma parcela como CONFIRMADO (paidDate = now). Se TODAS as parcelas
   *  estiverem pagas, o recebimento pai também vira CONFIRMADO.
   *  Dispara notificação + push "Pagamento recebido" para a empresa. */
  async payInstallment(companyId: string, paymentId: string, installmentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, companyId, deletedAt: null },
      select: { id: true, amount: true },
    });
    if (!payment) throw new NotFoundException('Recebimento não encontrado');

    const installment = await this.prisma.paymentInstallment.findFirst({
      where: { id: installmentId, paymentId, companyId },
      select: { id: true, status: true },
    });
    if (!installment) throw new NotFoundException('Parcela não encontrada');

    if (installment.status !== 'CONFIRMADO') {
      await this.prisma.$transaction(async (tx) => {
        await tx.paymentInstallment.update({
          where: { id: installmentId },
          data: { status: 'CONFIRMADO', paidDate: new Date() },
        });

        const all = await tx.paymentInstallment.findMany({
          where: { paymentId },
          select: { status: true },
        });
        const allPaid = all.length > 0 && all.every((i) => i.status === 'CONFIRMADO');
        if (allPaid) {
          await tx.payment.update({
            where: { id: paymentId },
            data: { status: 'CONFIRMADO' },
          });
        }
      });

      // Notificação + push (não deve quebrar a confirmação em caso de falha)
      try {
        const body = `Pagamento de ${formatCurrency(payment.amount)} recebido`;
        await this.notificationsService.create(companyId, {
          type: 'PAYMENT_RECEIVED',
          title: 'Pagamento recebido',
          body,
          data: { paymentId, route: '/pagamentos' },
        });
        await this.pushService.sendToCompany(companyId, {
          title: 'Pagamento recebido',
          body,
          data: { route: '/pagamentos' },
        });
      } catch (error) {
        this.logger.warn(
          `Falha ao notificar pagamento recebido ${paymentId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return this.findOne(companyId, paymentId);
  }

  private buildInstallments(
    companyId: string,
    dto: CreatePaymentDto,
    count: number,
  ): Prisma.PaymentInstallmentCreateWithoutPaymentInput[] {
    const baseDate = dto.dueDate
      ? new Date(dto.dueDate)
      : dto.paymentDate
        ? new Date(dto.paymentDate)
        : new Date();

    return Array.from({ length: count }, (_, index) => {
      const provided = dto.installments?.[index];
      return {
        companyId,
        installmentNumber: index + 1,
        amount: provided ? provided.amount : this.splitAmount(dto.amount, count, index),
        dueDate: provided ? new Date(provided.dueDate) : this.addMonths(baseDate, index),
      };
    });
  }

  /** Divide o total em parcelas iguais (2 casas); a última absorve o resto do arredondamento. */
  private splitAmount(total: number, count: number, index: number): number {
    const base = Math.round((total * 100) / count) / 100;
    if (index === count - 1) {
      return Math.round((total - base * (count - 1)) * 100) / 100;
    }
    return base;
  }

  /** Soma meses sem estourar o dia (ex.: 31/01 + 1 mês → 28/02). */
  private addMonths(date: Date, months: number): Date {
    const d = new Date(date);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
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

  /** Valida que a OS existe, pertence à empresa ativa e não foi removida.
   *  Retorna { id, clientId } para permitir validar a coerência
   *  cliente ↔ ordem de serviço no recebimento. */
  private async ensureServiceOrderBelongsToCompany(
    companyId: string,
    serviceOrderId: string,
  ): Promise<{ id: string; clientId: string }> {
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, companyId, deletedAt: null },
      select: { id: true, clientId: true },
    });
    if (!so) {
      throw new BadRequestException(
        'Ordem de serviço inválida: não pertence à empresa ativa',
      );
    }
    return so;
  }

  private convertDecimals(payment: any) {
    return {
      ...payment,
      amount: Number(payment.amount),
      installments: payment.installments
        ? payment.installments.map((i: any) => ({ ...i, amount: Number(i.amount) }))
        : undefined,
    };
  }
}