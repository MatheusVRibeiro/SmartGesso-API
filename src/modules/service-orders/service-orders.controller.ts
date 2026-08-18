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
import { ServiceOrdersService } from './service-orders.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';

@ApiTags('service-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard)
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Get()
  findAll(
    @Req() r: any,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.serviceOrdersService.findAll(r.company.id, search, status);
  }

  @Get(':id')
  findOne(@Req() r: any, @Param('id') id: string) {
    return this.serviceOrdersService.findOne(r.company.id, id);
  }

  @Post()
  create(@Req() r: any, @Body() dto: CreateServiceOrderDto) {
    return this.serviceOrdersService.create(r.company.id, dto);
  }

  @Patch(':id')
  update(@Req() r: any, @Param('id') id: string, @Body() dto: UpdateServiceOrderDto) {
    return this.serviceOrdersService.update(r.company.id, id, dto);
  }

  @Delete(':id')
  remove(@Req() r: any, @Param('id') id: string) {
    return this.serviceOrdersService.remove(r.company.id, id);
  }
}
