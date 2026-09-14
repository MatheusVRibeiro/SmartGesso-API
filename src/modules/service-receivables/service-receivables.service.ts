import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { formatCurrency } from '../../common/utils/format-currency';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../notifications/push.service';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { UpdateInstallmentDto } from './dto/update-installment.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ServiceReceivablesService {
  private readonly logger = new Logger(ServiceReceivablesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService,
  ) {}

  async generateReceivables(serviceOrderId: string, companyId: string, dto: CreateReceivableDto) {
    const serviceOrder = await this.prisma.serviceOrder.findFirst({
      where: {
        id: serviceOrderId,
        companyId,
      },
    });

    if (!serviceOrder) {
      throw new NotFoundException('Ordem de serviço não encontrada');
    }

    if (!serviceOrder.saleValue || serviceOrder.saleValue.lte(0)) {
      throw new BadRequestException('Ordem de serviço não possui valor de venda para gerar recebíveis');
    }

    const existingReceivable = await this.prisma.serviceReceivable.findFirst({
      where: {
        serviceOrderId,
        companyId,
      },
    });

    if (existingReceivable) {
      throw new BadRequestException('Ordem de serviço já possui recebíveis gerados');
    }

    const total = serviceOrder.saleValue;
    const installmentAmount = total.dividedBy(dto.installments);

    const receivable = await this.prisma.serviceReceivable.create({
      data: {
        companyId,
        serviceOrderId,
        total,
        installments: {
          create: Array.from({ length: dto.installments }, (_, i) => {
            const dueDate = new Date(dto.firstDueDate);
            dueDate.setMonth(dueDate.getMonth() + i);
            
            return {
              installmentNumber: i + 1,
              amount: installmentAmount,
              dueDate,
              status: 'PENDING',
            };
          }),
        },
      },
      include: {
        installments: true,
      },
    });

    return receivable;
  }

  async getReceivablesByServiceOrder(serviceOrderId: string, companyId: string) {
    const receivables = await this.prisma.serviceReceivable.findMany({
      where: {
        serviceOrderId,
        companyId,
      },
      include: {
        installments: {
          orderBy: {
            installmentNumber: 'asc',
          },
        },
      },
    });

    return receivables;
  }

  async updateInstallment(
    receivableId: string,
    installmentId: string,
    companyId: string,
    dto: UpdateInstallmentDto,
  ) {
    const receivable = await this.prisma.serviceReceivable.findFirst({
      where: {
        id: receivableId,
        companyId,
      },
    });

    if (!receivable) {
      throw new NotFoundException('Recebível não encontrado');
    }

    const installment = await this.prisma.receivableInstallment.findFirst({
      where: {
        id: installmentId,
        receivableId,
      },
    });

    if (!installment) {
      throw new NotFoundException('Parcela não encontrada');
    }

    const updatedInstallment = await this.prisma.receivableInstallment.update({
      where: {
        id: installmentId,
      },
      data: {
        status: 'PAID',
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        paymentId: dto.paymentId,
      },
    });

    // Check if all installments are paid to update receivable status
    const allInstallments = await this.prisma.receivableInstallment.findMany({
      where: {
        receivableId,
      },
    });

    const totalPaid = allInstallments
      .filter((i: any) => i.status === 'PAID')
      .reduce((sum: Decimal, i: any) => sum.add(i.amount), new Decimal(0));

    let receivableStatus = 'PENDING';
    if (totalPaid.equals(receivable.total)) {
      receivableStatus = 'RECEIVED';
    } else if (totalPaid.greaterThan(0)) {
      receivableStatus = 'PARTIAL';
    }

    await this.prisma.serviceReceivable.update({
      where: {
        id: receivableId,
      },
      data: {
        status: receivableStatus as any,
      },
    });

    // Recebível integralmente recebido → notificação + push (não deve
    // quebrar a atualização em caso de falha)
    if (receivableStatus === 'RECEIVED') {
      try {
        const body = `Pagamento de ${formatCurrency(receivable.total)} recebido`;
        await this.notificationsService.create(companyId, {
          type: 'PAYMENT_RECEIVED',
          title: 'Pagamento recebido',
          body,
          data: { receivableId, route: '/pagamentos' },
        });
        await this.pushService.sendToCompany(companyId, {
          title: 'Pagamento recebido',
          body,
          data: { route: '/pagamentos' },
        });
      } catch (error) {
        this.logger.warn(
          `Falha ao notificar recebível recebido ${receivableId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return updatedInstallment;
  }
}
