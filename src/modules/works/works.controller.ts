import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { CompanyAccessGuard } from '../core/guards/company-access.guard';
import { PermissionsGuard } from '../core/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { WorksService } from './works.service';
/** @deprecated DTO legado — mantido para compatibilidade. */
import { CreateWorkDto } from './dto/create-work.dto';
/** @deprecated DTO legado — mantido para compatibilidade. */
import { UpdateWorkDto } from './dto/update-work.dto';

/**
 * @deprecated Endpoint legado de gerenciamento de Obras (Works).
 * Mantido para compatibilidade — não utilizar em novos fluxos.
 */
@ApiTags('works')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard, PermissionsGuard)
@Controller('works')
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  @Get()
  @RequirePermissions('services.read')
  findAll(@Req() r: any, @Query('search') search?: string) {
    return this.worksService.findAll(r.company.id, search);
  }

  @Get(':id')
  @RequirePermissions('services.read')
  findOne(@Req() r: any, @Param('id') id: string) {
    return this.worksService.findOne(r.company.id, id);
  }

  @Post()
  @RequirePermissions('services.update')
  create(@Req() r: any, @Body() dto: CreateWorkDto) {
    return this.worksService.create(r.company.id, dto);
  }

  @Patch(':id')
  @RequirePermissions('services.update')
  update(@Req() r: any, @Param('id') id: string, @Body() dto: UpdateWorkDto) {
    return this.worksService.update(r.company.id, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('services.update')
  remove(@Req() r: any, @Param('id') id: string) {
    return this.worksService.remove(r.company.id, id);
  }
}