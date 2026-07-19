import { Module } from '@nestjs/common';
import { CompanyController } from '../../controllers';

@Module({ controllers: [CompanyController] })
export class CompaniesModule {}
