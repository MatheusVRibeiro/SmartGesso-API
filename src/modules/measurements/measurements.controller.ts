import {
  Body,
  Controller,
  Delete,
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
import { PermissionsGuard } from '../core/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { MeasurementsService } from './measurements.service';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { UpdateMeasurementDto } from './dto/update-measurement.dto';

@ApiTags('measurements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller()
export class MeasurementsController {
  constructor(private readonly measurementsService: MeasurementsService) {}

  @Get('works/:workId/measurements')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('measurements.read')
  findAll(@Req() r: any, @Param('workId') workId: string) {
    return this.measurementsService.findAll(r.company.id, workId);
  }

  @Post('works/:workId/measurements')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('measurements.create')
  create(
    @Req() r: any,
    @Param('workId') workId: string,
    @Body() dto: CreateMeasurementDto,
  ) {
    return this.measurementsService.create(r.company.id, workId, dto);
  }

  @Get('measurements/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('measurements.read')
  findOne(@Req() r: any, @Param('id') id: string) {
    return this.measurementsService.findOne(r.company.id, id);
  }

  @Patch('measurements/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('measurements.update')
  update(
    @Req() r: any,
    @Param('id') id: string,
    @Body() dto: UpdateMeasurementDto,
  ) {
    return this.measurementsService.update(r.company.id, id, dto);
  }

  @Delete('measurements/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('measurements.update')
  remove(@Req() r: any, @Param('id') id: string) {
    return this.measurementsService.remove(r.company.id, id);
  }
}
