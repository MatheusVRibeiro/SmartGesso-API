import { Module } from '@nestjs/common';
import { PlatformCompaniesController } from './platform-companies.controller';

@Module({ controllers: [PlatformCompaniesController] })
export class PlatformCompaniesModule {}
