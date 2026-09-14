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
import { QuoteEnvironmentsService } from './quote-environments.service';
import { CreateQuoteEnvironmentDto } from './dto/create-quote-environment.dto';
import { UpdateQuoteEnvironmentDto } from './dto/update-quote-environment.dto';
import { CreateQuoteEnvironmentMeasurementDto } from './dto/create-quote-environment-measurement.dto';
import { UpdateQuoteEnvironmentMeasurementDto } from './dto/update-quote-environment-measurement.dto';

@ApiTags('quotes-environments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard, PermissionsGuard)
@Controller('quotes')
export class QuoteEnvironmentsController {
  constructor(
    private readonly quoteEnvironmentsService: QuoteEnvironmentsService,
  ) {}

  // ── Ambientes ──────────────────────────────────────────────────────

  @Get(':quoteId/environments')
  @RequirePermissions('quotes.read')
  findEnvironments(
    @Req() r: any,
    @Param('quoteId') quoteId: string,
  ) {
    return this.quoteEnvironmentsService.findEnvironments(
      r.company.id,
      quoteId,
    );
  }

  @Post(':quoteId/environments')
  @RequirePermissions('quotes.update')
  createEnvironment(
    @Req() r: any,
    @Param('quoteId') quoteId: string,
    @Body() dto: CreateQuoteEnvironmentDto,
  ) {
    return this.quoteEnvironmentsService.createEnvironment(
      r.company.id,
      quoteId,
      dto,
    );
  }

  @Patch(':quoteId/environments/:environmentId')
  @RequirePermissions('quotes.update')
  updateEnvironment(
    @Req() r: any,
    @Param('quoteId') quoteId: string,
    @Param('environmentId') environmentId: string,
    @Body() dto: UpdateQuoteEnvironmentDto,
  ) {
    return this.quoteEnvironmentsService.updateEnvironment(
      r.company.id,
      quoteId,
      environmentId,
      dto,
    );
  }

  @Delete(':quoteId/environments/:environmentId')
  @RequirePermissions('quotes.update')
  removeEnvironment(
    @Req() r: any,
    @Param('quoteId') quoteId: string,
    @Param('environmentId') environmentId: string,
  ) {
    return this.quoteEnvironmentsService.removeEnvironment(
      r.company.id,
      quoteId,
      environmentId,
    );
  }

  // ── Medições dentro de ambientes ───────────────────────────────────

  @Post(':quoteId/environments/:environmentId/measurements')
  @RequirePermissions('quotes.update')
  createMeasurement(
    @Req() r: any,
    @Param('quoteId') quoteId: string,
    @Param('environmentId') environmentId: string,
    @Body() dto: CreateQuoteEnvironmentMeasurementDto,
  ) {
    return this.quoteEnvironmentsService.createMeasurement(
      r.company.id,
      quoteId,
      environmentId,
      dto,
    );
  }

  @Patch(':quoteId/environments/:environmentId/measurements/:id')
  @RequirePermissions('quotes.update')
  updateMeasurement(
    @Req() r: any,
    @Param('quoteId') quoteId: string,
    @Param('environmentId') environmentId: string,
    @Param('id') id: string,
    @Body() dto: UpdateQuoteEnvironmentMeasurementDto,
  ) {
    return this.quoteEnvironmentsService.updateMeasurement(
      r.company.id,
      quoteId,
      environmentId,
      id,
      dto,
    );
  }
}
