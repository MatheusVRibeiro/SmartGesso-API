import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { MemoryStore } from './database/memory.store';
import { PERMISSIONS_KEY } from './common/decorators/require-permissions.decorator';

export interface TokenPayload {
  sub: string;
  type: 'platform' | 'user';
  companyId?: string;
}

function bearer(req: any) {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : undefined;
}

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private store: MemoryStore,
  ) {}

  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = bearer(req);
    if (!token) throw new UnauthorizedException('Token ausente');

    const payload = this.jwt.verify<TokenPayload>(token, {
      secret: process.env.PLATFORM_JWT_ACCESS_SECRET || 'dev-platform-access',
    });
    if (payload.type !== 'platform') throw new ForbiddenException('Rota exclusiva da plataforma');

    const admin = this.store.platformAdmins.get(payload.sub);
    if (!admin || admin.status !== 'ACTIVE')
      throw new UnauthorizedException('Administrador inválido');

    req.platformAdmin = admin;
    return true;
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private store: MemoryStore,
  ) {}

  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = bearer(req);
    if (!token) throw new UnauthorizedException('Token ausente');

    const payload = this.jwt.verify<TokenPayload>(token, {
      secret: process.env.JWT_ACCESS_SECRET || 'dev-user-access',
    });
    if (payload.type !== 'user') throw new ForbiddenException('Token inválido para aplicativo');

    const user = this.store.users.get(payload.sub);
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Usuário inválido');

    req.user = user;
    req.companyId = payload.companyId ?? user.activeCompanyId;
    return true;
  }
}

@Injectable()
export class ActiveCompanyGuard implements CanActivate {
  constructor(private store: MemoryStore) {}

  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const companyId = req.companyId;
    const member = [...this.store.members.values()].find(
      (item) =>
        item.userId === req.user.id && item.companyId === companyId && item.status === 'ACTIVE',
    );
    const company = companyId ? this.store.companies.get(companyId) : undefined;
    if (!company || !member)
      throw new ForbiddenException('Empresa ativa não selecionada ou sem vínculo');

    req.company = company;
    req.member = member;
    return true;
  }
}

@Injectable()
export class CompanyAccessGuard implements CanActivate {
  constructor(private store: MemoryStore) {}

  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const company = req.company;
    const subscription = [...this.store.subscriptions.values()].find(
      (item) =>
        item.companyId === company.id &&
        ['TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD'].includes(item.status),
    );
    const blocked =
      !subscription ||
      ['SUSPENDED', 'BLOCKED'].includes(company.status) ||
      ['SUSPENDED', 'CANCELLED', 'EXPIRED'].includes(subscription.status);

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

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];
    const req = ctx.switchToHttp().getRequest();
    if (
      required.length &&
      !required.every((permission) => req.member?.permissions?.includes(permission))
    ) {
      throw new ForbiddenException('Permissão insuficiente');
    }

    return true;
  }
}
