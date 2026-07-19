import { Module } from '@nestjs/common';
import { CompanyController } from './companies.controller';

@Module({ controllers: [CompanyController] })
export class CompaniesModule {}
