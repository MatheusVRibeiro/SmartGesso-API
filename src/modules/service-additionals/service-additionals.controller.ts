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
import { ServiceAdditionalsService } from './service-additionals.service';
import { CreateServiceAdditionalDto } from './dto/create-service-additional.dto';
import { UpdateServiceAdditionalDto } from './dto/update-service-additional.dto';
import { UpdateServiceAdditionalStatusDto } from './dto/update-service-additional-status.dto';

@ApiTags('service-additionals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller('service-orders/:serviceOrderId/additionals')
export class ServiceAdditionalsController {
  constructor(
    private readonly serviceAdditionalsService: ServiceAdditionalsService,
  ) {}

  @Get()
  list(@Req() r: any, @Param('serviceOrderId') serviceOrderId: string) {
    return this.serviceAdditionalsService.list(r.company.id, serviceOrderId);
  }

  @Post()
  create(
    @Req() r: any,
    @Param('serviceOrderId') serviceOrderId: string,
    @Body() dto: CreateServiceAdditionalDto,
  ) {
    return this.serviceAdditionalsService.create(
      r.company.id,
      serviceOrderId,
      dto,
      r.user.id,
    );
  }

  @Patch(':id')
  update(
    @Req() r: any,
    @Param('serviceOrderId') serviceOrderId: string,
    @Param('id') id: string,
    @Body() dto: UpdateServiceAdditionalDto,
  ) {
    return this.serviceAdditionalsService.update(
      r.company.id,
      serviceOrderId,
      id,
      dto,
    );
  }

  @Patch(':id/status')
  updateStatus(
    @Req() r: any,
    @Param('serviceOrderId') serviceOrderId: string,
    @Param('id') id: string,
    @Body() dto: UpdateServiceAdditionalStatusDto,
  ) {
    return this.serviceAdditionalsService.updateStatus(
      r.company.id,
      serviceOrderId,
      id,
      dto.status,
      dto.note,
    );
  }
}
