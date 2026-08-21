import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../database/prisma.service';
import { requireSecret } from '../../auth/auth.service';

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

    try {
      const decoded = this.jwt.decode(token) as TokenPayload | null;
      if (!decoded) throw new UnauthorizedException('Token inválido');

      if (decoded.type !== 'platform') {
        throw new ForbiddenException('Rota exclusiva da plataforma');
      }

      const payload = this.jwt.verify<TokenPayload>(token, {
        secret: requireSecret('PLATFORM_JWT_ACCESS_SECRET'),
      });

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
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException) throw err;
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}
