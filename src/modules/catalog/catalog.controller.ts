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
import { CatalogService } from './catalog.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@ApiTags('catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // ------------------------------------------------------------------
  // Products
  // ------------------------------------------------------------------

  @Get('products')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('catalog.read')
  listProducts(@Req() r: any, @Query('search') search?: string) {
    return this.catalog.listProducts(r.company.id, search);
  }

  @Post('products')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('catalog.create')
  createProduct(@Req() r: any, @Body() dto: CreateProductDto) {
    return this.catalog.createProduct(r.company.id, dto);
  }

  @Get('products/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('catalog.read')
  getProduct(@Req() r: any, @Param('id') id: string) {
    return this.catalog.getProduct(r.company.id, id);
  }

  @Patch('products/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('catalog.update')
  updateProduct(
    @Req() r: any,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(r.company.id, id, dto);
  }

  @Delete('products/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('catalog.update')
  removeProduct(@Req() r: any, @Param('id') id: string) {
    return this.catalog.removeProduct(r.company.id, id);
  }

  // ------------------------------------------------------------------
  // Services
  // ------------------------------------------------------------------

  @Get('services')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('catalog.read')
  listServices(@Req() r: any, @Query('search') search?: string) {
    return this.catalog.listServices(r.company.id, search);
  }

  @Post('services')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('catalog.create')
  createService(@Req() r: any, @Body() dto: CreateServiceDto) {
    return this.catalog.createService(r.company.id, dto);
  }

  @Get('services/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('catalog.read')
  getService(@Req() r: any, @Param('id') id: string) {
    return this.catalog.getService(r.company.id, id);
  }

  @Patch('services/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('catalog.update')
  updateService(
    @Req() r: any,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.catalog.updateService(r.company.id, id, dto);
  }

  @Delete('services/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('catalog.update')
  removeService(@Req() r: any, @Param('id') id: string) {
    return this.catalog.removeService(r.company.id, id);
  }

  // ------------------------------------------------------------------
  // Materials
  // ------------------------------------------------------------------

  @Get('materials')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('catalog.read')
  listMaterials(@Req() r: any, @Query('search') search?: string) {
    return this.catalog.listMaterials(r.company.id, search);
  }

  @Post('materials')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('catalog.create')
  createMaterial(@Req() r: any, @Body() dto: CreateMaterialDto) {
    return this.catalog.createMaterial(r.company.id, dto);
  }

  @Get('materials/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('catalog.read')
  getMaterial(@Req() r: any, @Param('id') id: string) {
    return this.catalog.getMaterial(r.company.id, id);
  }

  @Patch('materials/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('catalog.update')
  updateMaterial(
    @Req() r: any,
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDto,
  ) {
    return this.catalog.updateMaterial(r.company.id, id, dto);
  }

  @Delete('materials/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('catalog.update')
  removeMaterial(@Req() r: any, @Param('id') id: string) {
    return this.catalog.removeMaterial(r.company.id, id);
  }
}
