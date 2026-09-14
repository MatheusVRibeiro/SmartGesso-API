import { Module } from '@nestjs/common';
import { QuoteEnvironmentsController } from './quote-environments.controller';
import { QuoteEnvironmentsService } from './quote-environments.service';

@Module({
  controllers: [QuoteEnvironmentsController],
  providers: [QuoteEnvironmentsService],
  exports: [QuoteEnvironmentsService],
})
export class QuoteEnvironmentsModule {}
