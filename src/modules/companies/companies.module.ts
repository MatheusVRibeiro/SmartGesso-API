import { Module } from '@nestjs/common';
import { CompanyController } from './companies.controller';
import { CompanyFeaturesController } from './company-features.controller';

@Module({ controllers: [CompanyController, CompanyFeaturesController] })
export class CompaniesModule {}
