import { Module } from '@nestjs/common';
import { CompanyDashboardController } from './company-dashboard.controller';

@Module({
  controllers: [CompanyDashboardController],
})
export class CompanyDashboardModule {}