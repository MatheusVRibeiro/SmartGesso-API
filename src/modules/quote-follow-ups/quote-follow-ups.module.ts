import { Module } from '@nestjs/common';
import { QuoteFollowUpsController } from './quote-follow-ups.controller';
import { QuoteFollowUpsService } from './quote-follow-ups.service';

@Module({
  controllers: [QuoteFollowUpsController],
  providers: [QuoteFollowUpsService],
})
export class QuoteFollowUpsModule {}
