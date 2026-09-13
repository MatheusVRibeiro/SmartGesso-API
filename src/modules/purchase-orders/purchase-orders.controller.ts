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
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderStatusDto } from './dto/update-purchase-order-status.dto';

@ApiTags('purchase-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(
    private readonly purchaseOrders: PurchaseOrdersService,
  ) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('inventory.read')
  list(
    @Req() r: any,
    @Query('serviceOrderId') serviceOrderId?: string,
  ) {
    return this.purchaseOrders.findAll(r.company.id, serviceOrderId);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('inventory.read')
  get(@Req() r: any, @Param('id') id: string) {
    return this.purchaseOrders.findOne(r.company.id, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('inventory.create')
  create(@Req() r: any, @Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrders.create(r.company.id, dto);
  }

  @Patch(':id/status')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('inventory.update')
  updateStatus(
    @Req() r: any,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderStatusDto,
  ) {
    return this.purchaseOrders.updateStatus(r.company.id, id, dto.status);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('inventory.update')
  remove(@Req() r: any, @Param('id') id: string) {
    return this.purchaseOrders.remove(r.company.id, id);
  }
}
