import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../database/prisma.service';

export interface TokenPayload {
  sub: string;
  type: 'platform' | 'user';
  companyId?: string;
}

function bearer(req: any): string | undefined {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : undefined;
}

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const token = bearer(req);
    if (!token) throw new UnauthorizedException('Token ausente');

    const payload = this.jwt.verify<TokenPayload>(token, {
      secret: process.env.PLATFORM_JWT_ACCESS_SECRET || 'dev-platform-access',
    });

    if (payload.type !== 'platform')
      throw new UnauthorizedException('Rota exclusiva da plataforma');

    const admin = await this.prisma.platformAdmin.findFirst({
      where: {
        id: payload.sub,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    if (!admin) throw new UnauthorizedException('Administrador inválido');

    req.platformAdmin = admin;
    return true;
  }
}
