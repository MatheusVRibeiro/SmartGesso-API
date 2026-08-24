import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { CompanyAccessGuard } from '../core/guards/company-access.guard';
import { ServiceWarrantiesService } from './service-warranties.service';
import { CreateServiceWarrantyDto } from './dto/create-service-warranty.dto';
import { UpdateServiceWarrantyStatusDto } from './dto/update-service-warranty-status.dto';
import { CreateServiceReturnDto } from './dto/create-service-return.dto';
import { UpdateServiceReturnStatusDto } from './dto/update-service-return-status.dto';

@ApiTags('service-warranties')
@ApiBearerAuth()
@Controller('service-warranties')
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
export class ServiceWarrantiesController {
  constructor(
    private readonly serviceWarrantiesService: ServiceWarrantiesService,
  ) {}

  // ── Warranty (nested under service-orders) ──────────────────────────

  @Get('service-orders/:serviceOrderId/warranty')
  listWarranties(
    @Req() r: any,
    @Param('serviceOrderId') serviceOrderId: string,
  ) {
    return this.serviceWarrantiesService.listWarranties(
      r.company.id,
      serviceOrderId,
    );
  }

  @Post('service-orders/:serviceOrderId/warranty')
  createWarranty(
    @Req() r: any,
    @Param('serviceOrderId') serviceOrderId: string,
    @Body() dto: CreateServiceWarrantyDto,
  ) {
    return this.serviceWarrantiesService.createWarranty(
      r.company.id,
      serviceOrderId,
      dto,
    );
  }

  // ── Warranty status (top-level) ─────────────────────────────────────

  @Patch('service-warranties/:id/status')
  updateWarrantyStatus(
    @Req() r: any,
    @Param('id') id: string,
    @Body() dto: UpdateServiceWarrantyStatusDto,
  ) {
    return this.serviceWarrantiesService.updateWarrantyStatus(
      r.company.id,
      id,
      dto.status,
    );
  }

  // ── Returns (nested under service-orders) ───────────────────────────

  @Get('service-orders/:serviceOrderId/returns')
  listReturns(
    @Req() r: any,
    @Param('serviceOrderId') serviceOrderId: string,
  ) {
    return this.serviceWarrantiesService.listReturns(
      r.company.id,
      serviceOrderId,
    );
  }

  @Post('service-orders/:serviceOrderId/returns')
  createReturn(
    @Req() r: any,
    @Param('serviceOrderId') serviceOrderId: string,
    @Body() dto: CreateServiceReturnDto,
  ) {
    return this.serviceWarrantiesService.createReturn(
      r.company.id,
      serviceOrderId,
      dto,
    );
  }

  // ── Return status (top-level) ───────────────────────────────────────

  @Patch('service-returns/:id/status')
  updateReturnStatus(
    @Req() r: any,
    @Param('id') id: string,
    @Body() dto: UpdateServiceReturnStatusDto,
  ) {
    return this.serviceWarrantiesService.updateReturnStatus(
      r.company.id,
      id,
      dto.status,
      dto.resolutionNote,
    );
  }
}
