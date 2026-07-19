import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { CompanyAccessGuard } from '../core/guards/company-access.guard';
import { PermissionsGuard } from '../core/guards/permissions.guard';
import { BusinessService } from '../../business.service';
import { UpdateCompanyDto } from '../platform-companies/dto/update-company.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';

@ApiTags('company')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard)
@Controller('company')
export class CompanyController {
  constructor(private biz: BusinessService) {}

  @Get('access-status')
  access(@Req() r: any) {
    return this.biz.accessStatus(r.company.id);
  }

  @Get('permissions')
  perms(@Req() r: any) {
    return { permissions: r.member.permissions };
  }

  @UseGuards(CompanyAccessGuard, PermissionsGuard)
  @Get('profile')
  profile(@Req() r: any) {
    return r.company;
  }

  @UseGuards(CompanyAccessGuard, PermissionsGuard)
  @Patch('profile')
  patch(
    @Req() r: any,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.biz.updateCompany(r.company.id, dto);
  }

  @UseGuards(CompanyAccessGuard, PermissionsGuard)
  @Get('branding')
  branding(@Req() r: any) {
    return this.biz.branding(r.company.id);
  }

  @UseGuards(CompanyAccessGuard, PermissionsGuard)
  @Patch('branding')
  patchBranding(
    @Req() r: any,
    @Body() dto: UpdateBrandingDto,
  ) {
    return this.biz.branding(r.company.id, dto);
  }
}
