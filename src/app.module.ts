import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ClientsModule } from './modules/clients/clients.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { CoreModule } from './modules/core/core.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { PlansModule } from './modules/plans/plans.module';
import { PlatformAuthModule } from './modules/platform-auth/platform-auth.module';
import { PlatformCompaniesModule } from './modules/platform-companies/platform-companies.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { WorksModule } from './modules/works/works.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({}),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    CoreModule,
    DashboardModule,
    HealthModule,
    PlatformAuthModule,
    PlatformCompaniesModule,
    PlansModule,
    SubscriptionsModule,
    AuthModule,
    ClientsModule,
    CompaniesModule,
    CatalogModule,
    WorksModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
