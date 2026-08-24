import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ClientsModule } from './modules/clients/clients.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { CompositionsModule } from './modules/compositions/compositions.module';
import { CoreModule } from './modules/core/core.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { HealthModule } from './modules/health/health.module';
import { MeasurementsModule } from './modules/measurements/measurements.module';
import { PlansModule } from './modules/plans/plans.module';
import { PlatformAuthModule } from './modules/platform-auth/platform-auth.module';
import { PlatformCompaniesModule } from './modules/platform-companies/platform-companies.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { WorksModule } from './modules/works/works.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { QuoteEnvironmentsModule } from './modules/quote-environments/quote-environments.module';
import { ProductionOrdersModule } from './modules/production-orders/production-orders.module';
import { ServiceOrdersModule } from './modules/service-orders/service-orders.module';
import { ServiceAdditionalsModule } from './modules/service-additionals/service-additionals.module';
import { ServiceWarrantiesModule } from './modules/service-warranties/service-warranties.module';
import { PaymentsModule } from './modules/payments/payments.module';
// Alias para não colidir com o ScheduleModule do @nestjs/schedule (cron)
import { ScheduleModule as ScheduleEventsModule } from './modules/schedule/schedule.module';
import { CompanyDashboardModule } from './modules/company-dashboard/company-dashboard.module';
import { CompanyMembersModule } from './modules/company-members/company-members.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';

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
    CompanyDashboardModule,
    CompanyMembersModule,
    ExpensesModule,
    PlatformAuthModule,
    PlatformCompaniesModule,
    PlansModule,
    SubscriptionsModule,
    AuthModule,
    ClientsModule,
    CompaniesModule,
    CatalogModule,
    WorksModule,
    MeasurementsModule,
    CompositionsModule,
    QuotesModule,
    QuoteEnvironmentsModule,
    ProductionOrdersModule,
    ServiceOrdersModule,
    ServiceAdditionalsModule,
    ServiceWarrantiesModule,
    PaymentsModule,
    ScheduleEventsModule,
    InventoryModule,
    NotificationsModule,
    UploadsModule,
    AttachmentsModule,
    SuppliersModule,
    PurchaseOrdersModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
