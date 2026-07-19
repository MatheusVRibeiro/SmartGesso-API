import { Module } from '@nestjs/common';
import { PlatformCompaniesController } from '../../controllers';

@Module({ controllers: [PlatformCompaniesController] })
export class PlatformCompaniesModule {}
