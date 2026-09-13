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
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QuoteStatus } from '@prisma/client';
import { Response } from 'express';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { CompanyAccessGuard } from '../core/guards/company-access.guard';
import { PermissionsGuard } from '../core/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { QuotesService } from './quotes.service';
import { QuotesPdfService } from './quotes-pdf.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { CreatePublicShareDto } from './dto/create-public-share.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly quotesPdfService: QuotesPdfService,
  ) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('quotes.read')
  @ApiOperation({ summary: 'Lista orçamentos da empresa (paginado)' })
  findAll(
    @Req() r: any,
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
    @Query('status') status?: QuoteStatus,
  ) {
    return this.quotesService.findAll(r.company.id, pagination, search, status);
  }

  @Get('by-token/:token')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('quotes.read')
  @ApiOperation({ summary: 'Busca orçamento pelo token público (deep link)' })
  findByToken(@Req() r: any, @Param('token') token: string) {
    return this.quotesService.findByCompanyToken(r.company.id, token);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('quotes.read')
  @ApiOperation({ summary: 'Busca orçamento por ID' })
  findOne(@Req() r: any, @Param('id') id: string) {
    return this.quotesService.findOne(r.company.id, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('quotes.create')
  @ApiOperation({ summary: 'Cria novo orçamento' })
  create(@Req() r: any, @Body() dto: CreateQuoteDto) {
    return this.quotesService.create(r.company.id, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('quotes.update')
  @ApiOperation({ summary: 'Atualiza orçamento' })
  update(@Req() r: any, @Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotesService.update(r.company.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('quotes.cancel')
  @ApiOperation({ summary: 'Remove orçamento' })
  remove(@Req() r: any, @Param('id') id: string) {
    return this.quotesService.remove(r.company.id, id);
  }

  @Post(':id/version')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('quotes.create')
  @ApiOperation({ summary: 'Cria nova versão do orçamento' })
  createVersion(@Req() r: any, @Param('id') id: string) {
    return this.quotesService.createVersion(r.company.id, id);
  }

  @Post(':id/convert-to-service')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('quotes.approve')
  @ApiOperation({
    summary: 'Converte orçamento aprovado em OS',
    deprecated: true,
    description:
      'Use POST /quotes/:id/approve (idempotente). Este endpoint será removido em versão futura.',
  })
  convertToService(@Req() r: any, @Param('id') id: string) {
    return this.quotesService.convertToService(r.company.id, id);
  }

  @Post(':id/approve')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('quotes.approve')
  @ApiOperation({ summary: 'Aprova o orçamento (status APROVADO + histórico)' })
  approve(@Req() r: any, @Param('id') id: string) {
    return this.quotesService.approve(r.company.id, id, r.user?.id);
  }

  @Post(':id/reject')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('quotes.cancel')
  @ApiOperation({ summary: 'Rejeita o orçamento (status REJEITADO + histórico)' })
  reject(
    @Req() r: any,
    @Param('id') id: string,
    @Body('note') note?: string,
  ) {
    return this.quotesService.reject(r.company.id, id, note, r.user?.id);
  }

  @Post(':id/duplicate')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('quotes.create')
  @ApiOperation({
    summary: 'Duplica o orçamento (novo quoteNumber, status RASCUNHO)',
  })
  duplicate(@Req() r: any, @Param('id') id: string) {
    return this.quotesService.duplicate(r.company.id, id);
  }

  @Post(':id/share')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('quotes.read')
  @ApiOperation({
    summary:
      'Cria deep link público do orçamento (token + URL). Idempotente: reutiliza o token se já existir.',
  })
  share(@Req() r: any, @Param('id') id: string, @Body() dto: CreatePublicShareDto) {
    return this.quotesService.share(r.company.id, id, dto);
  }

  @Get(':id/pdf')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('quotes.generate_pdf')
  @ApiOperation({ summary: 'Gera PDF do orçamento' })
  async generatePdf(@Req() r: any, @Param('id') id: string, @Res() res: Response) {
    try {
      const pdf = await this.quotesPdfService.generatePdf(id, r.company.id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="orcamento-${id}.pdf"`);
      pdf.pipe(res);
    } catch {
      res.status(500).json({ statusCode: 500, message: 'Erro ao gerar PDF' });
    }
  }
}
