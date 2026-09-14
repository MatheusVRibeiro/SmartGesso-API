import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { CompanyAccessGuard } from '../core/guards/company-access.guard';
import { PermissionsGuard } from '../core/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CompanyFeaturesService } from '../core/services/company-features.service';
import { UpdateFeatureOverrideDto } from './dto/update-feature-override.dto';

/**
 * Feature flags da empresa (ETAPA 13 V4).
 *
 * - GET  /companies/features               → features efetivas (plan + overrides)
 * - GET  /companies/features/overrides     → overrides cadastrados da empresa
 * - PUT  /companies/features/overrides/:feature → habilita/desabilita feature
 *
 * Guard chain: JwtAuthGuard → ActiveCompanyGuard → CompanyAccessGuard.
 * Override exige permissão `company.features.override` (OWNER/MANAGER).
 */
@ApiTags('company-features')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller('companies')
export class CompanyFeaturesController {
  constructor(private readonly features: CompanyFeaturesService) {}

  @Get('features')
  async effective(@Req() r: any) {
    const features = await this.features.getEffectiveFeatures(r.company.id);
    return { features };
  }

  @Get('features/overrides')
  overrides(@Req() r: any) {
    return this.features.listOverrides(r.company.id);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions('company.features.override')
  @Put('features/overrides/:feature')
  setOverride(
    @Req() r: any,
    @Param('feature') feature: string,
    @Body() dto: UpdateFeatureOverrideDto,
  ) {
    return this.features.setOverride(
      r.company.id,
      feature,
      dto.enabled,
      r.user?.id,
    );
  }
}
