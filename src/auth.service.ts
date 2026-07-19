import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { MemoryStore } from './database/memory.store';
import { PrismaService } from './database/prisma.service';
@Injectable()
export class AuthService {
  constructor(
    private store: MemoryStore,
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}
  async ensureSeed() {
    if (
      ![...this.store.platformAdmins.values()].some((a) => a.email === 'admin@smartgesso.local')
    ) {
      const id = this.store.id();
      this.store.platformAdmins.set(id, {
        id,
        name: 'Admin SmartGesso',
        email: 'admin@smartgesso.local',
        passwordHash: await argon2.hash('Admin@123456'),
        status: 'ACTIVE',
      });
    }
  }
  private platformTokens(id: string) {
    return {
      accessToken: this.jwt.sign(
        { sub: id, type: 'platform' },
        {
          secret: process.env.PLATFORM_JWT_ACCESS_SECRET || 'dev-platform-access',
          expiresIn: '15m',
        },
      ),
      refreshToken: this.jwt.sign(
        { sub: id, type: 'platform' },
        {
          secret: process.env.PLATFORM_JWT_REFRESH_SECRET || 'dev-platform-refresh',
          expiresIn: '30d',
        },
      ),
    };
  }
  private userTokens(id: string, companyId?: string) {
    return {
      accessToken: this.jwt.sign(
        { sub: id, type: 'user', companyId },
        { secret: process.env.JWT_ACCESS_SECRET || 'dev-user-access', expiresIn: '15m' },
      ),
      refreshToken: this.jwt.sign(
        { sub: id, type: 'user' },
        { secret: process.env.JWT_REFRESH_SECRET || 'dev-user-refresh', expiresIn: '30d' },
      ),
    };
  }
  async platformLogin(email: string, password: string) {
    await this.ensureSeed();
    const a = [...this.store.platformAdmins.values()].find((x) => x.email === email);
    if (!a || !(await argon2.verify(a.passwordHash, password)))
      throw new UnauthorizedException('Credenciais inválidas');
    a.lastLoginAt = new Date();
    const t = this.platformTokens(a.id);
    a.refreshTokenHash = await argon2.hash(t.refreshToken);
    return { admin: { id: a.id, name: a.name, email: a.email }, ...t };
  }
  async platformRefresh(token: string) {
    const p = this.jwt.verify<{ sub: string }>(token, {
      secret: process.env.PLATFORM_JWT_REFRESH_SECRET || 'dev-platform-refresh',
    });
    const a = this.store.platformAdmins.get(p.sub);
    if (!a?.refreshTokenHash || !(await argon2.verify(a.refreshTokenHash, token)))
      throw new UnauthorizedException('Refresh inválido');
    const t = this.platformTokens(a.id);
    a.refreshTokenHash = await argon2.hash(t.refreshToken);
    return t;
  }
  async acceptInvitation(token: string, password: string) {
    // Buscar todos os convites pendentes (não aceitos e não expirados)
    const invitations = await this.prisma.ownerInvitation.findMany({
      where: {
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    // Verificar cada convite com argon2 (não podemos buscar por hash diretamente)
    let matchedInv: (typeof invitations)[0] | null = null;
    for (const inv of invitations) {
      if (await argon2.verify(inv.tokenHash, token)) {
        matchedInv = inv;
        break;
      }
    }

    if (!matchedInv) {
      throw new BadRequestException('Convite inválido ou expirado');
    }

    // Transação: criar User + CompanyMember + marcar convite aceito
    const result = await this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email: matchedInv!.email } });

      if (!user) {
        user = await tx.user.create({
          data: {
            name: matchedInv!.name,
            email: matchedInv!.email,
            passwordHash: await argon2.hash(password),
            status: 'ACTIVE',
          },
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash: await argon2.hash(password),
            status: 'ACTIVE',
          },
        });
      }

      const existingMember = await tx.companyMember.findUnique({
        where: {
          companyId_userId: {
            companyId: matchedInv!.companyId,
            userId: user.id,
          },
        },
      });

      let member;
      if (existingMember) {
        member = await tx.companyMember.update({
          where: { id: existingMember.id },
          data: { status: 'ACTIVE', isOwner: true, joinedAt: new Date() },
        });
      } else {
        member = await tx.companyMember.create({
          data: {
            companyId: matchedInv!.companyId,
            userId: user.id,
            status: 'ACTIVE',
            isOwner: true,
            joinedAt: new Date(),
          },
        });
      }

      await tx.ownerInvitation.update({
        where: { id: matchedInv!.id },
        data: { acceptedAt: new Date() },
      });

      return { user, member };
    });

    return {
      user: { id: result.user.id, name: result.user.name, email: result.user.email },
      companyId: matchedInv.companyId,
      ...this.userTokens(result.user.id, matchedInv.companyId),
    };
  }
  async userLogin(email: string, password: string) {
    const u = [...this.store.users.values()].find((x) => x.email === email);
    if (!u || !(await argon2.verify(u.passwordHash, password)))
      throw new UnauthorizedException('Credenciais inválidas');
    const t = this.userTokens(u.id, u.activeCompanyId);
    u.refreshTokenHash = await argon2.hash(t.refreshToken);
    return {
      user: { id: u.id, name: u.name, email: u.email },
      activeCompanyId: u.activeCompanyId,
      ...t,
    };
  }
  companies(userId: string) {
    return [...this.store.members.values()]
      .filter((m) => m.userId === userId)
      .map((m) => ({
        company: this.store.companies.get(m.companyId),
        member: { isOwner: m.isOwner, status: m.status },
      }));
  }
  switchCompany(userId: string, companyId: string) {
    const m = [...this.store.members.values()].find(
      (x) => x.userId === userId && x.companyId === companyId && x.status === 'ACTIVE',
    );
    if (!m) throw new ForbiddenException('Usuário sem vínculo com a empresa');
    const u = this.store.users.get(userId)!;
    u.activeCompanyId = companyId;
    return { activeCompanyId: companyId, ...this.userTokens(userId, companyId) };
  }
}
