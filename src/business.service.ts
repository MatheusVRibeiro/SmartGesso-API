import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InstallmentStatus, Prisma, SubscriptionStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaRepositoryService } from './database/prisma-repository.service';
import { PrismaService } from './database/prisma.service';

const ACTIVE_ACCESS_STATUSES: SubscriptionStatus[] = [
  'TRIAL',
  'ACTIVE',
  'PAST_DUE',
  'GRACE_PERIOD',
];

@Injectable()
export class BusinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: PrismaRepositoryService,
  ) {}

  async createCompany(dto: any) {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          legalName: dto.legalName,
          tradeName: dto.tradeName,
          documentType: dto.documentType ?? 'CNPJ',
          document: dto.document,
          stateRegistration: dto.stateRegistration,
          municipalRegistration: dto.municipalRegistration,
          email: dto.email,
          phone: dto.phone,
          whatsapp: dto.whatsapp,
          timezone: dto.timezone ?? 'America/Sao_Paulo',
          status: dto.status ?? 'ACTIVE',
        },
      });

      await tx.companyBranding.create({
        data: {
          companyId: company.id,
          displayName: dto.branding?.displayName ?? company.tradeName,
          logoUrl: dto.branding?.logoUrl,
          primaryColor: dto.branding?.primaryColor,
          secondaryColor: dto.branding?.secondaryColor,
          commercialEmail: dto.branding?.commercialEmail ?? company.email,
          commercialPhone: dto.branding?.commercialPhone ?? company.phone,
          commercialWhatsapp: dto.branding?.commercialWhatsapp ?? company.whatsapp,
          showSmartGessoBrand: dto.branding?.showSmartGessoBrand ?? true,
        },
      });

      return company;
    });
  }

  async listCompanies() {
    return this.prisma.company.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateCompany(id: string, dto: any) {
    await this.company(id);
    return this.prisma.company.update({
      where: { id },
      data: {
        legalName: dto.legalName,
        tradeName: dto.tradeName,
        documentType: dto.documentType,
        document: dto.document,
        stateRegistration: dto.stateRegistration,
        municipalRegistration: dto.municipalRegistration,
        email: dto.email,
        phone: dto.phone,
        whatsapp: dto.whatsapp,
        status: dto.status,
        timezone: dto.timezone,
      },
    });
  }

  async company(id: string) {
    const company = await this.prisma.company.findFirst({ where: { id, deletedAt: null } });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }

  async setCompanyStatus(id: string, status: any) {
    await this.company(id);
    return this.prisma.company.update({ where: { id }, data: { status } });
  }

  async inviteOwner(companyId: string, dto: any) {
    await this.company(companyId);
    const token = randomUUID();
    const tokenHash = await argon2.hash(token);

    const invitation = await this.prisma.ownerInvitation.create({
      data: {
        companyId,
        email: dto.email,
        name: dto.name,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 864e5),
      },
    });

    return { ...invitation, token };
  }

  async createPlan(dto: any) {
    return this.prisma.plan.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        billingType: dto.billingType ?? 'MONTHLY',
        defaultPrice: this.repository.money(dto.defaultPrice),
        maxUsers: dto.maxUsers ?? 3,
        maxStorageMb: dto.maxStorageMb ?? 1024,
        features: (dto.features ?? []) as Prisma.InputJsonValue,
        showSmartGessoBrand: dto.showSmartGessoBrand ?? true,
        status: dto.status ?? 'ACTIVE',
      },
    });
  }

  async listPlans() {
    return this.prisma.plan.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async plan(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    return plan;
  }

  async updatePlan(id: string, dto: any) {
    await this.plan(id);
    return this.prisma.plan.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        billingType: dto.billingType,
        defaultPrice:
          dto.defaultPrice === undefined ? undefined : this.repository.money(dto.defaultPrice),
        maxUsers: dto.maxUsers,
        maxStorageMb: dto.maxStorageMb,
        features: dto.features === undefined ? undefined : (dto.features as Prisma.InputJsonValue),
        showSmartGessoBrand: dto.showSmartGessoBrand,
        status: dto.status,
      },
    });
  }

  async createSubscription(companyId: string, dto: any, adminId: string) {
    await this.company(companyId);
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new BadRequestException('Plano inválido');

    const grace = Number(process.env.SUBSCRIPTION_DEFAULT_GRACE_DAYS ?? 7);
    const endDate = new Date(dto.endDate);
    const status = (dto.status ?? 'ACTIVE') as SubscriptionStatus;

    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          companyId,
          planId: dto.planId,
          startDate: new Date(dto.startDate),
          endDate,
          gracePeriodEnd: new Date(endDate.getTime() + grace * 864e5),
          status,
          billingType: dto.billingType ?? plan.billingType,
          agreedPrice: this.repository.money(dto.agreedPrice ?? plan.defaultPrice),
          autoRenew: dto.autoRenew ?? false,
          createdByPlatformAdminId: adminId,
        },
      });

      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: subscription.id,
          companyId,
          newStatus: status,
          reason: 'subscription.created',
          changedByPlatformAdminId: adminId,
        },
      });

      return subscription;
    });
  }

  async listCompanySubscriptions(companyId: string) {
    await this.company(companyId);
    return this.prisma.subscription.findMany({
      where: { companyId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async subscription(id: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });
    if (!subscription) throw new NotFoundException('Contrato não encontrado');
    return subscription;
  }

  async updateSubscription(id: string, dto: any) {
    await this.subscription(id);
    return this.prisma.subscription.update({
      where: { id },
      data: {
        planId: dto.planId,
        startDate: dto.startDate === undefined ? undefined : new Date(dto.startDate),
        endDate: dto.endDate === undefined ? undefined : new Date(dto.endDate),
        gracePeriodEnd: dto.gracePeriodEnd === undefined ? undefined : new Date(dto.gracePeriodEnd),
        status: dto.status,
        billingType: dto.billingType,
        agreedPrice:
          dto.agreedPrice === undefined ? undefined : this.repository.money(dto.agreedPrice),
        autoRenew: dto.autoRenew,
        cancellationReason: dto.cancellationReason,
        suspensionReason: dto.suspensionReason,
      },
    });
  }

  async setSubscriptionStatus(
    id: string,
    status: SubscriptionStatus,
    reason: string,
    adminId: string,
  ) {
    const subscription = await this.subscription(id);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id },
        data: {
          status,
          suspendedAt: status === 'SUSPENDED' ? now : undefined,
          reactivatedAt: status === 'ACTIVE' ? now : undefined,
          cancelledAt: status === 'CANCELLED' ? now : undefined,
        },
      });

      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: id,
          companyId: subscription.companyId,
          previousStatus: subscription.status,
          newStatus: status,
          reason,
          changedByPlatformAdminId: adminId,
        },
      });

      return updated;
    });
  }

  async renew(id: string, dto: any, adminId: string) {
    const subscription = await this.subscription(id);
    const endDate = new Date(dto.endDate);
    const grace = Number(process.env.SUBSCRIPTION_DEFAULT_GRACE_DAYS ?? 7);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id },
        data: {
          startDate: new Date(dto.startDate),
          endDate,
          gracePeriodEnd: new Date(endDate.getTime() + grace * 864e5),
          status: 'ACTIVE',
        },
      });

      await tx.company.update({
        where: { id: subscription.companyId },
        data: { status: 'ACTIVE' },
      });
      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: id,
          companyId: subscription.companyId,
          previousStatus: subscription.status,
          newStatus: 'ACTIVE',
          reason: 'subscription.renewed',
          changedByPlatformAdminId: adminId,
        },
      });

      return updated;
    });
  }

  async generateInstallments(id: string, dto: any) {
    const subscription = await this.subscription(id);
    const count = Number(dto.count ?? 1);
    const firstDueDate = new Date(dto.firstDueDate ?? subscription.startDate);
    const total = this.repository.money(dto.amount ?? subscription.agreedPrice);
    const amount = total.div(count).toDecimalPlaces(2);

    return this.prisma.$transaction(
      Array.from({ length: count }, (_, index) =>
        this.prisma.subscriptionInstallment.create({
          data: {
            subscriptionId: id,
            companyId: subscription.companyId,
            installmentNumber: index + 1,
            description: dto.description ?? `Mensalidade ${index + 1}/${count}`,
            amount,
            dueDate: new Date(firstDueDate.getTime() + index * 30 * 864e5),
            paidAmount: this.repository.money(0),
            status: 'PENDING',
          },
        }),
      ),
    );
  }

  async listInstallments(subscriptionId: string) {
    await this.subscription(subscriptionId);
    return this.prisma.subscriptionInstallment.findMany({
      where: { subscriptionId },
      orderBy: { installmentNumber: 'asc' },
    });
  }

  async updateInstallment(id: string, dto: any) {
    await this.installment(id);
    return this.prisma.subscriptionInstallment.update({
      where: { id },
      data: {
        description: dto.description,
        amount: dto.amount === undefined ? undefined : this.repository.money(dto.amount),
        dueDate: dto.dueDate === undefined ? undefined : new Date(dto.dueDate),
        paidAmount:
          dto.paidAmount === undefined ? undefined : this.repository.money(dto.paidAmount),
        paidAt: dto.paidAt === undefined ? undefined : new Date(dto.paidAt),
        status: dto.status,
        paymentMethod: dto.paymentMethod,
        externalReference: dto.externalReference,
        notes: dto.notes,
      },
    });
  }

  async cancelInstallment(id: string) {
    await this.installment(id);
    return this.prisma.subscriptionInstallment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async payInstallment(id: string, dto: any, adminId: string) {
    const installment = await this.installment(id);
    const amount = this.repository.money(dto.amount);
    const paidAt = new Date(dto.paidAt ?? Date.now());
    const status: InstallmentStatus = amount.greaterThanOrEqualTo(installment.amount)
      ? 'PAID'
      : 'PARTIALLY_PAID';

    return this.prisma.$transaction(async (tx) => {
      await tx.subscriptionInstallment.update({
        where: { id },
        data: { paidAmount: amount, paidAt, status, paymentMethod: dto.paymentMethod },
      });

      return tx.subscriptionPayment.create({
        data: {
          subscriptionInstallmentId: id,
          companyId: installment.companyId,
          amount,
          paymentMethod: dto.paymentMethod,
          paidAt,
          reference: dto.reference,
          notes: dto.notes,
          createdByPlatformAdminId: adminId,
        },
      });
    });
  }

  async accessStatus(companyId: string) {
    const company = await this.company(companyId);
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    const allowed =
      company.status === 'ACTIVE' &&
      !!subscription &&
      ACTIVE_ACCESS_STATUSES.includes(subscription.status);

    return {
      company: { id: company.id, tradeName: company.tradeName },
      accessStatus: subscription?.status ?? company.status,
      planName: subscription?.plan.name,
      endDate: subscription?.endDate,
      accessAllowed: allowed,
      blockMessage: allowed ? null : 'O acesso da empresa está suspenso.',
      support: { email: process.env.APP_SUPPORT_EMAIL, phone: process.env.APP_SUPPORT_PHONE },
    };
  }

  async branding(companyId: string, dto?: any) {
    const where = this.repository.tenantScope(companyId);
    const branding = await this.prisma.companyBranding.findFirst({ where });
    if (!branding) throw new NotFoundException('Branding não encontrado');
    if (!dto) return branding;

    return this.prisma.companyBranding.update({
      where: { id: branding.id },
      data: {
        displayName: dto.displayName,
        logoUrl: dto.logoUrl,
        primaryColor: dto.primaryColor,
        secondaryColor: dto.secondaryColor,
        commercialEmail: dto.commercialEmail,
        commercialPhone: dto.commercialPhone,
        commercialWhatsapp: dto.commercialWhatsapp,
        website: dto.website,
        instagram: dto.instagram,
        quoteFooter: dto.quoteFooter,
        defaultWarrantyText: dto.defaultWarrantyText,
        pixKey: dto.pixKey,
        bankInformation: dto.bankInformation,
        showSmartGessoBrand: dto.showSmartGessoBrand,
      },
    });
  }

  private async installment(id: string) {
    const installment = await this.prisma.subscriptionInstallment.findUnique({ where: { id } });
    if (!installment) throw new NotFoundException('Mensalidade não encontrada');
    return installment;
  }
}
