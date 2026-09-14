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
import { ProductionOrdersService } from './production-orders.service';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import { RegisterProductionDto } from './dto/register-production.dto';

@ApiTags('production-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller('production-orders')
export class ProductionOrdersController {
  constructor(private readonly productionOrdersService: ProductionOrdersService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('production.read')
  findAll(
    @Req() r: any,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.productionOrdersService.findAll(r.company.id, search, status);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('production.read')
  findOne(@Req() r: any, @Param('id') id: string) {
    return this.productionOrdersService.findOne(r.company.id, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('production.create')
  create(@Req() r: any, @Body() dto: CreateProductionOrderDto) {
    return this.productionOrdersService.create(r.company.id, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('production.update')
  update(
    @Req() r: any,
    @Param('id') id: string,
    @Body() dto: UpdateProductionOrderDto,
  ) {
    return this.productionOrdersService.update(r.company.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('production.update')
  remove(@Req() r: any, @Param('id') id: string) {
    return this.productionOrdersService.remove(r.company.id, id);
  }

  @Post(':itemId/production')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('production.update')
  registerProduction(
    @Req() r: any,
    @Param('itemId') itemId: string,
    @Body() dto: RegisterProductionDto,
  ) {
    return this.productionOrdersService.registerProduction(
      r.company.id,
      itemId,
      dto,
    );
  }
}
