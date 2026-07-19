import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformAdminGuard } from '../core/guards/platform-admin.guard';
import { BusinessService } from '../../business.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@ApiTags('platform-plans')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@Controller('platform/plans')
export class PlansController {
  constructor(private biz: BusinessService) {}

  @Post()
  create(@Body() dto: CreatePlanDto) {
    return this.biz.createPlan(dto);
  }

  @Get()
  list() {
    return this.biz.listPlans();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.biz.plan(id);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.biz.updatePlan(id, dto);
  }
}
