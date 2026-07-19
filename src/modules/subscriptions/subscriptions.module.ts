import { Module } from '@nestjs/common';
import { SubscriptionsController } from '../../controllers';

@Module({ controllers: [SubscriptionsController] })
export class SubscriptionsModule {}
