import { Module } from '@nestjs/common';
import { ProductionOrdersController } from './production-orders.controller';
import { ProductionOrdersService } from './production-orders.service';

@Module({
  controllers: [ProductionOrdersController],
  providers: [ProductionOrdersService],
})
export class ProductionOrdersModule {}
