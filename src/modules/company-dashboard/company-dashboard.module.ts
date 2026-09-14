import { Module } from '@nestjs/common';
import { CompanyDashboardController } from './company-dashboard.controller';
import { PerformanceService } from './performance.service';
import { DashboardOverviewService } from './dashboard-overview.service';

@Module({
  controllers: [CompanyDashboardController],
  providers: [PerformanceService, DashboardOverviewService],
  exports: [DashboardOverviewService, PerformanceService],
})
export class CompanyDashboardModule {}

