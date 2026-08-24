import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../database/prisma.module';
import { BusinessService } from '../../business.service';
import { CompanySequenceService } from './services/company-sequence.service';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ActiveCompanyGuard } from './guards/active-company.guard';
import { CompanyAccessGuard } from './guards/company-access.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@Global()
@Module({
  imports: [JwtModule.register({}), PrismaModule],
  providers: [
    BusinessService,
    CompanySequenceService,
    PlatformAdminGuard,
    JwtAuthGuard,
    ActiveCompanyGuard,
    CompanyAccessGuard,
    PermissionsGuard,
  ],
  exports: [
    JwtModule,
    BusinessService,
    CompanySequenceService,
    PlatformAdminGuard,
    JwtAuthGuard,
    ActiveCompanyGuard,
    CompanyAccessGuard,
    PermissionsGuard,
  ],
})
export class CoreModule {}
