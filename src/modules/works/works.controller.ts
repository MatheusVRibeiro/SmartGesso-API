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
import { WorksService } from './works.service';
import { CreateWorkDto } from './dto/create-work.dto';
import { UpdateWorkDto } from './dto/update-work.dto';

@ApiTags('works')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard)
@Controller('works')
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  @Get()
  findAll(@Req() r: any, @Query('search') search?: string) {
    return this.worksService.findAll(r.company.id, search);
  }

  @Get(':id')
  findOne(@Req() r: any, @Param('id') id: string) {
    return this.worksService.findOne(r.company.id, id);
  }

  @Post()
  create(@Req() r: any, @Body() dto: CreateWorkDto) {
    return this.worksService.create(r.company.id, dto);
  }

  @Patch(':id')
  update(@Req() r: any, @Param('id') id: string, @Body() dto: UpdateWorkDto) {
    return this.worksService.update(r.company.id, id, dto);
  }

  @Delete(':id')
  remove(@Req() r: any, @Param('id') id: string) {
    return this.worksService.remove(r.company.id, id);
  }
}