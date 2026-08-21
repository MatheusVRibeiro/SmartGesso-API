import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAdminGuard } from '../core/guards/platform-admin.guard';

@ApiTags('platform-dashboard')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@Controller('platform/dashboard')
export class DashboardController {
  constructor(private prisma: PrismaService) {}

  @Get('metrics')
  async getMetrics() {
    const totalCompanies = await this.prisma.company.count();
    const activeCompanies = await this.prisma.company.count({ where: { status: 'ACTIVE' } });
    const suspendedCompanies = await this.prisma.company.count({ where: { status: 'SUSPENDED' } });
    const blockedCompanies = await this.prisma.company.count({ where: { status: 'BLOCKED' } });

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const newCompanies = await this.prisma.company.count({
      where: { createdAt: { gte: currentMonth } },
    });

    const totalSubscriptions = await this.prisma.subscription.count();
    const activeSubscriptions = await this.prisma.subscription.count({
      where: { status: 'ACTIVE' },
    });

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringContracts = await this.prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        endDate: { lte: thirtyDaysFromNow },
      },
    });

    const totalInstallments = await this.prisma.subscriptionInstallment.aggregate({
      _sum: { amount: true },
      where: { status: 'PAID' },
    });

    const pendingInstallments = await this.prisma.subscriptionInstallment.aggregate({
      _sum: { amount: true },
      where: { status: 'PENDING' },
    });

    const overdueInstallments = await this.prisma.subscriptionInstallment.count({
      where: {
        status: 'PENDING',
        dueDate: { lt: new Date() },
      },
    });

    return {
      totalCompanies,
      activeCompanies,
      suspendedCompanies,
      blockedCompanies,
      newCompanies,
      totalSubscriptions,
      activeSubscriptions,
      expiringContracts,
      totalRevenue: totalInstallments._sum.amount || 0,
      pendingRevenue: pendingInstallments._sum.amount || 0,
      overdueInstallments,
    };
  }
}
