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
import { ScheduleService } from './schedule.service';
import { CreateScheduleEventDto } from './dto/create-schedule-event.dto';
import { UpdateScheduleEventDto } from './dto/update-schedule-event.dto';

@ApiTags('schedule')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard, PermissionsGuard)
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get()
  @RequirePermissions('services.read')
  findAll(
    @Req() r: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.scheduleService.findAll(r.company.id, from, to);
  }

  @Get('today')
  @RequirePermissions('services.read')
  findToday(@Req() r: any) {
    return this.scheduleService.findToday(r.company.id);
  }

  @Get(':id')
  @RequirePermissions('services.read')
  findOne(@Req() r: any, @Param('id') id: string) {
    return this.scheduleService.findOne(r.company.id, id);
  }

  @Post()
  @RequirePermissions('services.update')
  create(@Req() r: any, @Body() dto: CreateScheduleEventDto) {
    return this.scheduleService.create(r.company.id, dto);
  }

  @Patch(':id')
  @RequirePermissions('services.update')
  update(@Req() r: any, @Param('id') id: string, @Body() dto: UpdateScheduleEventDto) {
    return this.scheduleService.update(r.company.id, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('services.update')
  remove(@Req() r: any, @Param('id') id: string) {
    return this.scheduleService.remove(r.company.id, id);
  }
}