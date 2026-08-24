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
import { QuoteFollowUpsService } from './quote-follow-ups.service';
import { CreateQuoteFollowUpDto } from './dto/create-quote-follow-up.dto';
import { UpdateQuoteFollowUpDto } from './dto/update-quote-follow-up.dto';
import { UpdateQuoteFollowUpStatusDto } from './dto/update-quote-follow-up-status.dto';

/**
 * Follow-up comercial de orçamentos (ETAPA 12).
 *
 * Rotas mistas de propósito: aninhadas em /quotes/:quoteId/follow-ups,
 * top-level em /quote-follow-ups/:id e agenda do dia em /follow-ups/today —
 * por isso o controller NÃO tem prefixo (mesmo padrão do MeasurementsController).
 */
@ApiTags('quote-follow-ups')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
export class QuoteFollowUpsController {
  constructor(
    private readonly quoteFollowUpsService: QuoteFollowUpsService,
  ) {}

  /** Lista os follow-ups de um orçamento. */
  @Get('quotes/:quoteId/follow-ups')
  listByQuote(@Req() r: any, @Param('quoteId') quoteId: string) {
    return this.quoteFollowUpsService.listByQuote(r.company.id, quoteId);
  }

  /** Cria um follow-up para um orçamento. */
  @Post('quotes/:quoteId/follow-ups')
  create(
    @Req() r: any,
    @Param('quoteId') quoteId: string,
    @Body() dto: CreateQuoteFollowUpDto,
  ) {
    return this.quoteFollowUpsService.create(
      r.company.id,
      r.user?.id,
      quoteId,
      dto,
    );
  }

  /** Atualiza campos editáveis de um follow-up. */
  @Patch('quote-follow-ups/:id')
  update(
    @Req() r: any,
    @Param('id') id: string,
    @Body() dto: UpdateQuoteFollowUpDto,
  ) {
    return this.quoteFollowUpsService.update(r.company.id, id, dto);
  }

  /** Transiciona o status de um follow-up (PENDING → DONE | CANCELLED). */
  @Patch('quote-follow-ups/:id/status')
  updateStatus(
    @Req() r: any,
    @Param('id') id: string,
    @Body() dto: UpdateQuoteFollowUpStatusDto,
  ) {
    return this.quoteFollowUpsService.updateStatus(
      r.company.id,
      id,
      dto.status,
    );
  }

  /** Agenda do dia: follow-ups PENDING agendados até o fim de hoje. */
  @Get('follow-ups/today')
  listToday(@Req() r: any) {
    return this.quoteFollowUpsService.listToday(r.company.id);
  }
}
