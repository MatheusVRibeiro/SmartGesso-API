import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InventoryMovementType } from '@prisma/client';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { CompanyAccessGuard } from '../core/guards/company-access.guard';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../core/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AdjustMaterialStockDto } from './dto/adjust-material-stock.dto';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // ------------------------------------------------------------------
  // Movimentos
  // ------------------------------------------------------------------

  @Get('movements')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('inventory.read')
  listMovements(
    @Req() r: any,
    @Query('materialId') materialId?: string,
    @Query('serviceOrderId') serviceOrderId?: string,
    @Query('type') type?: InventoryMovementType,
  ) {
    return this.inventory.listMovements(r.company.id, {
      materialId,
      serviceOrderId,
      type,
    });
  }

  @Post('movements')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('inventory.create')
  createMovement(@Req() r: any, @Body() dto: CreateInventoryMovementDto) {
    return this.inventory.createMovement(r.company.id, dto);
  }

  // ------------------------------------------------------------------
  // Materiais (visão de estoque)
  // ------------------------------------------------------------------

  @Get('materials')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('inventory.read')
  listMaterials(@Req() r: any, @Query('search') search?: string) {
    return this.inventory.listMaterials(r.company.id, search);
  }

  @Get('materials/:id/movements')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('inventory.read')
  getMaterialMovements(@Req() r: any, @Param('id') id: string) {
    return this.inventory.getMaterialMovements(r.company.id, id);
  }

  @Post('materials/:id/adjust')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('inventory.adjust')
  adjustStock(
    @Req() r: any,
    @Param('id') id: string,
    @Body() dto: AdjustMaterialStockDto,
  ) {
    return this.inventory.adjustStock(r.company.id, id, dto);
  }
}
