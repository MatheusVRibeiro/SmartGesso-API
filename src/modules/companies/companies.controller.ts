import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { CompanyAccessGuard } from '../core/guards/company-access.guard';
import { PermissionsGuard } from '../core/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
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
  @ApiOperation({ summary: 'Status de acesso e plano da empresa' })
  access(@Req() r: any) {
    return this.biz.accessStatus(r.company.id);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Permissões do membro logado' })
  perms(@Req() r: any) {
    return { permissions: r.member.permissions };
  }

  @UseGuards(CompanyAccessGuard, PermissionsGuard)
  @RequirePermissions('company.read')
  @Get('profile')
  @ApiOperation({ summary: 'Dados da empresa' })
  profile(@Req() r: any) {
    return r.company;
  }

  @UseGuards(CompanyAccessGuard, PermissionsGuard)
  @RequirePermissions('company.update')
  @Patch('profile')
  @ApiOperation({ summary: 'Atualiza dados da empresa' })
  patch(
    @Req() r: any,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.biz.updateCompany(r.company.id, dto);
  }

  @UseGuards(CompanyAccessGuard, PermissionsGuard)
  @RequirePermissions('company.branding.read')
  @Get('branding')
  @ApiOperation({ summary: 'Dados de branding da empresa' })
  branding(@Req() r: any) {
    return this.biz.branding(r.company.id);
  }

  @UseGuards(CompanyAccessGuard, PermissionsGuard)
  @RequirePermissions('company.branding.update')
  @Patch('branding')
  @ApiOperation({ summary: 'Atualiza branding da empresa' })
  patchBranding(
    @Req() r: any,
    @Body() dto: UpdateBrandingDto,
  ) {
    return this.biz.branding(r.company.id, dto);
  }
}
