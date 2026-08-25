import { Module } from '@nestjs/common';
import { ServiceReceivablesService } from './service-receivables.service';
import { ServiceReceivablesController } from './service-receivables.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ServiceReceivablesController],
  providers: [ServiceReceivablesService],
  exports: [ServiceReceivablesService],
})
export class ServiceReceivablesModule {}
