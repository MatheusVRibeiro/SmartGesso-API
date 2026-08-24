import { Module } from '@nestjs/common';
import { ServiceAdditionalsController } from './service-additionals.controller';
import { ServiceAdditionalsService } from './service-additionals.service';

@Module({
  controllers: [ServiceAdditionalsController],
  providers: [ServiceAdditionalsService],
})
export class ServiceAdditionalsModule {}
