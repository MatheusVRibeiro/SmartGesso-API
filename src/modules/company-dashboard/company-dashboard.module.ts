import { Module } from '@nestjs/common';
import { CompanyDashboardController } from './company-dashboard.controller';
import { PerformanceService } from './performance.service';

@Module({
  controllers: [CompanyDashboardController],
  providers: [PerformanceService],
})
export class CompanyDashboardModule {}
