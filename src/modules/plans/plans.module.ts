import { Module } from '@nestjs/common';
import { PlansController } from '../../controllers';

@Module({ controllers: [PlansController] })
export class PlansModule {}
