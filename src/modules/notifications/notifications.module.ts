import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { NotificationsCronService } from './notifications-cron.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, PushService, NotificationsCronService],
  exports: [NotificationsService, PushService],
})
export class NotificationsModule {}
