import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateExpenseDto) {
    if (dto.serviceOrderId) {
      await this.ensureServiceOrderBelongsToCompany(companyId, dto.serviceOrderId);
    }
    return this.prisma.expense.create({
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