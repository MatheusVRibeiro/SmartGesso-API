import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../notifications/push.service';
import { formatCurrency } from '../../common/utils/format-currency';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService,
  ) {}

  async create(companyId: string, dto: CreateExpenseDto, userId?: string) {
    if (dto.serviceOrderId) {
      await this.ensureServiceOrderBelongsToCompany(companyId, dto.serviceOrderId);
    }
    
    const expense = await this.prisma.expense.create({
      data: {
        companyId,
        serviceOrderId: dto.serviceOrderId,
        category: dto.category,
        description: dto.description,
        amount: dto.amount,
        // Mesmo fix do ServiceOrders: converter ISO-8601 para Date antes de persistir
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
        receiptUrl: dto.receiptUrl,
        observations: dto.observations,
      },
    });

    // Log audit event
    await this.auditLogService.log({
      companyId,
      userId,
      action: 'CREATE',
      entity: 'Expense',
      entityId: expense.id,
      details: {
        category: dto.category,
        amount: dto.amount,
        description: dto.description,
      },
    });

    // Notificação + push (não deve quebrar a criação em caso de falha)
    try {
      const body = `Despesa de ${formatCurrency(Number(expense.amount))} registrada`;
      await this.notificationsService.create(companyId, {
        type: 'EXPENSE_CREATED',
        title: 'Despesa registrada',
        body,
        data: { expenseId: expense.id, route: '/despesas' },
      });
      await this.pushService.sendToCompany(companyId, {
        title: 'Despesa registrada',
        body,
        data: { route: '/despesas' },
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao notificar despesa ${expense.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return expense;
  }

  async findAll(companyId: string, search?: string, category?: string) {
    const where: Prisma.ExpenseWhereInput = {
      companyId,
      deletedAt: null,
      ...(category ? { category: category as any } : {}),
      ...(search
        ? {
            OR: [
              { description: { contains: search } },
              { observations: { contains: search } },
            ],
          }
        : {}),
    };

    const expenses = await this.prisma.expense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
    });

    return expenses.map((expense) => this.convertDecimals(expense));
  }

  async findOne(companyId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!expense) throw new NotFoundException('Despesa não encontrada');
    return this.convertDecimals(expense);
  }

  async update(companyId: string, id: string, dto: UpdateExpenseDto) {
    await this.findOne(companyId, id);
    if (dto.serviceOrderId) {
      await this.ensureServiceOrderBelongsToCompany(companyId, dto.serviceOrderId);
    }
    return this.prisma.expense.update({
      where: { id },
      data: {
        category: dto.category,
        description: dto.description,
        amount: dto.amount,
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
        receiptUrl: dto.receiptUrl,
        observations: dto.observations,
        serviceOrderId: dto.serviceOrderId,
      },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** Decimal do Prisma → number no retorno (pitfall documentado). */
  private convertDecimals(expense: any) {
    return {
      ...expense,
      amount: Number(expense.amount),
    };
  }

  private async ensureServiceOrderBelongsToCompany(
    companyId: string,
    serviceOrderId: string,
  ) {
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!so) {
      throw new BadRequestException(
        'Ordem de serviço inválida: não pertence à empresa ativa',
      );
    }
  }
}