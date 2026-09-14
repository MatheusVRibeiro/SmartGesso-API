import { Module } from '@nestjs/common';
import { QuotesModule } from './quotes.module';
import { QuotesPublicController } from './quotes-public.controller';

/**
 * Módulo dos endpoints PÚBLICOS de orçamento (deep links).
 *
 * SEM guards de autenticação: o cliente acessa via token.
 * Rate limit agressivo (5 req/min por IP) é aplicado por rota no
 * controller via @Throttle.
 *
 * Reaproveita o QuotesService exportado pelo QuotesModule
 * (mesma instância, mesma lógica de approve/reject).
 */
@Module({
  imports: [QuotesModule],
  controllers: [QuotesPublicController],
})
export class QuotesPublicModule {}
