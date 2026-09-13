import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { CompanyAccessGuard } from '../core/guards/company-access.guard';
import { PermissionsGuard } from '../core/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { GoalsService } from './goals.service';
import { SetGoalDto } from './dto/set-goal.dto';

/**
 * Metas mensais por empresa (CompanyGoal).
 *
 * - GET  /goals?year=&month=  → meta do período (null se não existir)
 * - PUT  /goals               → cria/atualiza a meta do período (upsert)
 * - GET  /goals/list          → todas as metas da empresa
 *
 * Guard chain: JwtAuthGuard → ActiveCompanyGuard → CompanyAccessGuard.
 * PUT exige permissão `company_goals.manage` (OWNER/MANAGER — matriz em
 * company-permissions.ts). GET/list são leitura: qualquer membro ativo.
 */
@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  @ApiOperation({ summary: 'Meta do período (year/month); null se não existir' })
  getGoal(
    @Req() r: any,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const y = Number(year);
    const m = Number(month);
    if (!Number.isInteger(y) || !Number.isInteger(m)) {
      // Query params ausentes/inválidos → BadRequest (não vira NaN no where).
      throw new BadRequestException('year e month são obrigatórios (inteiros)');
    }
    return this.goalsService.getGoal(r.company.id, y, m);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions('company_goals.manage')
  @Put()
  @ApiOperation({ summary: 'Cria/atualiza a meta do período (upsert)' })
  setGoal(@Req() r: any, @Body() dto: SetGoalDto) {
    return this.goalsService.setGoal(r.company.id, r.user?.id, dto);
  }

  @Get('list')
  @ApiOperation({ summary: 'Todas as metas da empresa' })
  listGoals(@Req() r: any) {
    return this.goalsService.listGoals(r.company.id);
  }
}
