import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { QuotesService } from './quotes.service';
import { PublicRejectQuoteDto } from './dto/public-reject-quote.dto';

/**
 * Endpoints PÚBLICOS de orçamento (deep links) — SEM autenticação.
 *
 * O cliente acessa o link `https://app.smartgesso.com.br/o/:token` e o
 * frontend chama estes endpoints. Rate limit agressivo (5 req/min por IP)
 * protege contra força bruta no token.
 *
 * Segurança: os dados retornados são apenas os públicos do orçamento
 * (itens, total, validade, nome do cliente e status). Não expomos
 * companyId, CPF/documento, observações internas ou qualquer dado
 * sensível da empresa.
 */
@ApiTags('public-quotes')
@Controller('public/quotes')
export class QuotesPublicController {
  constructor(private readonly quotesService: QuotesService) {}

  @Get(':token')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Busca dados públicos do orçamento pelo token (sem auth)',
  })
  findByToken(@Param('token') token: string) {
    return this.quotesService.findPublicByToken(token);
  }

  @Post(':token/approve')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Aprova o orçamento publicamente pelo token (sem auth)',
  })
  approve(@Param('token') token: string, @Req() req: any) {
    const ip = req.ip as string | undefined;
    return this.quotesService.approvePublicByToken(token, ip);
  }

  @Post(':token/reject')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Rejeita o orçamento publicamente pelo token (sem auth)',
  })
  reject(@Param('token') token: string, @Body() dto: PublicRejectQuoteDto) {
    return this.quotesService.rejectPublicByToken(token, dto.note);
  }
}
