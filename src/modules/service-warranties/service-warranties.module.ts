import { Module } from '@nestjs/common';
import { ServiceWarrantiesController } from './service-warranties.controller';
import { ServiceWarrantiesService } from './service-warranties.service';

@Module({
  controllers: [ServiceWarrantiesController],
  providers: [ServiceWarrantiesService],
})
export class ServiceWarrantiesModule {}
