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
import { QuoteEnvironmentsService } from './quote-environments.service';
import { CreateQuoteEnvironmentDto } from './dto/create-quote-environment.dto';
import { UpdateQuoteEnvironmentDto } from './dto/update-quote-environment.dto';
import { CreateMeasurementDto } from '../measurements/dto/create-measurement.dto';
import { UpdateMeasurementDto } from '../measurements/dto/update-measurement.dto';

@ApiTags('quotes-environments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard)
@Controller('quotes')
export class QuoteEnvironmentsController {
  constructor(
    private readonly quoteEnvironmentsService: QuoteEnvironmentsService,
  ) {}

  // ── Ambientes ──────────────────────────────────────────────────────

  @Get(':quoteId/environments')
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
  createMeasurement(
    @Req() r: any,
    @Param('quoteId') quoteId: string,
    @Param('environmentId') environmentId: string,
    @Body() dto: CreateMeasurementDto,
  ) {
    return this.quoteEnvironmentsService.createMeasurement(
      r.company.id,
      quoteId,
      environmentId,
      dto,
    );
  }

  @Patch(':quoteId/environments/:environmentId/measurements/:id')
  updateMeasurement(
    @Req() r: any,
    @Param('quoteId') quoteId: string,
    @Param('environmentId') environmentId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMeasurementDto,
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
