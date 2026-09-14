import { Module } from '@nestjs/common';
import { ServiceAdditionalsController } from './service-additionals.controller';
import { ServiceAdditionalsService } from './service-additionals.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ServiceAdditionalsController],
  providers: [ServiceAdditionalsService],
})
export class ServiceAdditionalsModule {}
