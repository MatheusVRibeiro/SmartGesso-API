import { Module } from '@nestjs/common';
import { CompositionsController } from './compositions.controller';
import { CompositionsService } from './compositions.service';

@Module({
  controllers: [CompositionsController],
  providers: [CompositionsService],
})
export class CompositionsModule {}