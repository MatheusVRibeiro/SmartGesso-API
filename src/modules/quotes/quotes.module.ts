import { Module } from '@nestjs/common';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { QuotesPdfService } from './quotes-pdf.service';

@Module({
  controllers: [QuotesController],
  providers: [QuotesService, QuotesPdfService],
})
export class QuotesModule {}
