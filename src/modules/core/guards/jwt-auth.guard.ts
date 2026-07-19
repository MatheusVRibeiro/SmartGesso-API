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
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const token = bearer(req);
    if (!token) throw new UnauthorizedException('Token ausente');

    const payload = this.jwt.verify<TokenPayload>(token, {
      secret: process.env.JWT_ACCESS_SECRET || 'dev-user-access',
    });

    if (payload.type !== 'user')
      throw new UnauthorizedException('Token inválido para aplicativo');

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    if (!user) throw new UnauthorizedException('Usuário inválido');

    req.user = user;
    req.companyId = payload.companyId ?? null;
    return true;
  }
}
