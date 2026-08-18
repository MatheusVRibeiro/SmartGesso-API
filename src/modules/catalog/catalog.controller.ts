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
import { CatalogService } from './catalog.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@ApiTags('catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // ------------------------------------------------------------------
  // Products
  // ------------------------------------------------------------------

  @Get('products')
  listProducts(@Req() r: any, @Query('search') search?: string) {
    return this.catalog.listProducts(r.company.id, search);
  }

  @Post('products')
  createProduct(@Req() r: any, @Body() dto: CreateProductDto) {
    return this.catalog.createProduct(r.company.id, dto);
  }

  @Get('products/:id')
  getProduct(@Req() r: any, @Param('id') id: string) {
    return this.catalog.getProduct(r.company.id, id);
  }

  @Patch('products/:id')
  updateProduct(
    @Req() r: any,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(r.company.id, id, dto);
  }

  @Delete('products/:id')
  removeProduct(@Req() r: any, @Param('id') id: string) {
    return this.catalog.removeProduct(r.company.id, id);
  }

  // ------------------------------------------------------------------
  // Services
  // ------------------------------------------------------------------

  @Get('services')
  listServices(@Req() r: any, @Query('search') search?: string) {
    return this.catalog.listServices(r.company.id, search);
  }

  @Post('services')
  createService(@Req() r: any, @Body() dto: CreateServiceDto) {
    return this.catalog.createService(r.company.id, dto);
  }

  @Get('services/:id')
  getService(@Req() r: any, @Param('id') id: string) {
    return this.catalog.getService(r.company.id, id);
  }

  @Patch('services/:id')
  updateService(
    @Req() r: any,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.catalog.updateService(r.company.id, id, dto);
  }

  @Delete('services/:id')
  removeService(@Req() r: any, @Param('id') id: string) {
    return this.catalog.removeService(r.company.id, id);
  }

  // ------------------------------------------------------------------
  // Materials
  // ------------------------------------------------------------------

  @Get('materials')
  listMaterials(@Req() r: any, @Query('search') search?: string) {
    return this.catalog.listMaterials(r.company.id, search);
  }

  @Post('materials')
  createMaterial(@Req() r: any, @Body() dto: CreateMaterialDto) {
    return this.catalog.createMaterial(r.company.id, dto);
  }

  @Get('materials/:id')
  getMaterial(@Req() r: any, @Param('id') id: string) {
    return this.catalog.getMaterial(r.company.id, id);
  }

  @Patch('materials/:id')
  updateMaterial(
    @Req() r: any,
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDto,
  ) {
    return this.catalog.updateMaterial(r.company.id, id, dto);
  }

  @Delete('materials/:id')
  removeMaterial(@Req() r: any, @Param('id') id: string) {
    return this.catalog.removeMaterial(r.company.id, id);
  }
}