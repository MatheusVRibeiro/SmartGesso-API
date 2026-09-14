import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SetGoalDto } from './dto/set-goal.dto';

/** Include leve para serialização da API (consistente com os demais módulos). */
const GOAL_INCLUDE = {
  company: { select: { id: true, tradeName: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

/**
 * Metas mensais por empresa (CompanyGoal).
 *
 * - `getGoal` retorna `null` quando não existe meta para o período (não lança).
 * - `setGoal` faz upsert na unique `@@unique([companyId, year, month])`.
 * - `listGoals` lista todas as metas da empresa (tenant-scoped).
 */
@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca a meta do período (companyId + year + month).
   * Retorna `null` quando não existe — o endpoint GET responde 200 com null.
   */
  async getGoal(companyId: string, year: number, month: number) {
    return this.prisma.companyGoal.findFirst({
      where: { companyId, year, month },
      include: GOAL_INCLUDE,
    });
  }

  /**
   * Cria ou atualiza a meta do período (upsert na unique
   * `companyId_year_month`). `createdById` é gravado apenas na criação.
   */
  async setGoal(
    companyId: string,
    userId: string | undefined,
    dto: SetGoalDto,
  ) {
    return this.prisma.companyGoal.upsert({
      where: {
        companyId_year_month: {
          companyId,
          year: dto.year,
          month: dto.month,
        },
      },
      update: {
        targetQuoteAmount: dto.targetQuoteAmount,
        targetRevenue: dto.targetRevenue,
        targetApprovedQuotes: dto.targetApprovedQuotes,
      },
      create: {
        companyId,
        year: dto.year,
        month: dto.month,
        targetQuoteAmount: dto.targetQuoteAmount,
        targetRevenue: dto.targetRevenue,
        targetApprovedQuotes: dto.targetApprovedQuotes,
        createdById: userId ?? null,
      },
      include: GOAL_INCLUDE,
    });
  }

  /** Lista todas as metas da empresa, do período mais recente para o mais antigo. */
  async listGoals(companyId: string) {
    return this.prisma.companyGoal.findMany({
      where: { companyId },
      include: GOAL_INCLUDE,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }
}
