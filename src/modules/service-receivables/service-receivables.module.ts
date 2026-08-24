import { Module } from '@nestjs/common';
import { ServiceReceivablesService } from './service-receivables.service';
import { ServiceReceivablesController } from './service-receivables.controller';

@Module({
  controllers: [ServiceReceivablesController],
  providers: [ServiceReceivablesService],
  exports: [ServiceReceivablesService],
})
export class ServiceReceivablesModule {}
