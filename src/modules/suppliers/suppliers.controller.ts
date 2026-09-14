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
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto';

@ApiTags('suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard, PermissionsGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @RequirePermissions('inventory.read')
  list(@Req() r: any, @Query('search') search?: string) {
    return this.suppliers.findAll(r.company.id, search);
  }

  @Get(':id')
  @RequirePermissions('inventory.read')
  get(@Req() r: any, @Param('id') id: string) {
    return this.suppliers.findOne(r.company.id, id);
  }

  @Post()
  @RequirePermissions('inventory.create')
  create(@Req() r: any, @Body() dto: CreateSupplierDto) {
    return this.suppliers.create(r.company.id, dto);
  }

  @Patch(':id')
  @RequirePermissions('inventory.update')
  update(@Req() r: any, @Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliers.update(r.company.id, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('inventory.update')
  remove(@Req() r: any, @Param('id') id: string) {
    return this.suppliers.remove(r.company.id, id);
  }
}
