import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class CompanyAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const company = req.company;

    if (!company) {
      throw new HttpException(
        {
          code: 'COMPANY_ACCESS_DENIED',
          message: 'Nenhuma empresa ativa selecionada.',
          details: {
            companyName: null,
            accessStatus: null,
            supportPhone: process.env.APP_SUPPORT_PHONE ?? null,
          },
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const [subscription] = await Promise.all([
      this.prisma.subscription.findFirst({
        where: { companyId: company.id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const isExpired =
      subscription?.endDate && new Date(subscription.endDate) < new Date();
    const isGraceExpired =
      subscription?.gracePeriodEnd &&
      new Date(subscription.gracePeriodEnd) < new Date();

    const blocked =
      !subscription ||
      ['SUSPENDED', 'BLOCKED'].includes(company.status) ||
      ['SUSPENDED', 'CANCELLED', 'EXPIRED'].includes(subscription?.status as any) ||
      !!isExpired ||
      !!isGraceExpired;

    if (blocked) {
      throw new HttpException(
        {
          code: 'COMPANY_ACCESS_SUSPENDED',
          message: 'O acesso da empresa está suspenso.',
          details: {
            companyName: company.tradeName,
            accessStatus: subscription?.status ?? company.status,
            supportPhone: process.env.APP_SUPPORT_PHONE ?? null,
          },
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}
