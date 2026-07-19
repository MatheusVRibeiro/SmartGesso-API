import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface PlatformLoginResult extends TokenPair {
  admin: { id: string; name: string; email: string };
}

export interface UserLoginResult extends TokenPair {
  user: { id: string; name: string; email: string };
  activeCompanyId: string | null;
}

export interface AcceptInvitationResult extends TokenPair {
  user: { id: string; name: string; email: string };
  companyId: string;
}

export interface CompanyResult {
  company: {
    id: string;
    tradeName: string;
    document: string;
  };
  member: { isOwner: boolean; status: string };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // -----------------------------------------------------------------------
  // Seed inline
  // -----------------------------------------------------------------------
  async ensureSeed(): Promise<void> {
    const name = process.env.SEED_PLATFORM_ADMIN_NAME;
    const email = process.env.SEED_PLATFORM_ADMIN_EMAIL;
    const password = process.env.SEED_PLATFORM_ADMIN_PASSWORD;

    if (!name || !email || !password) return;

    const exists = await this.prisma.platformAdmin.findUnique({ where: { email } });
    if (exists) return;

    this.validatePassword(password);

    const hash = await argon2.hash(password);
    await this.prisma.platformAdmin.create({
      data: { name, email, passwordHash: hash, status: 'ACTIVE' },
    });
  }

  // -----------------------------------------------------------------------
  // Token helpers
  // -----------------------------------------------------------------------
  private platformTokens(sub: string): TokenPair {
    const accessOpts: any = {
      secret: process.env.PLATFORM_JWT_ACCESS_SECRET || 'dev-platform-access',
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    };
    const refreshOpts: any = {
      secret: process.env.PLATFORM_JWT_REFRESH_SECRET || 'dev-platform-refresh',
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    };
    return {
      accessToken: this.jwt.sign({ sub, type: 'platform' }, accessOpts),
      refreshToken: this.jwt.sign({ sub, type: 'platform' }, refreshOpts),
    };
  }

  private userTokens(sub: string, companyId?: string): TokenPair {
    const accessOpts: any = {
      secret: process.env.JWT_ACCESS_SECRET || 'dev-user-access',
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    };
    const refreshOpts: any = {
      secret: process.env.JWT_REFRESH_SECRET || 'dev-user-refresh',
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    };
    return {
      accessToken: this.jwt.sign({ sub, type: 'user', companyId }, accessOpts),
      refreshToken: this.jwt.sign({ sub, type: 'user' }, refreshOpts),
    };
  }

  // -----------------------------------------------------------------------
  // Password validation (seed)
  // -----------------------------------------------------------------------
  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new BadRequestException('A senha deve ter no mínimo 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException('A senha deve conter pelo menos uma letra maiúscula');
    }
    if (!/[a-z]/.test(password)) {
      throw new BadRequestException('A senha deve conter pelo menos uma letra minúscula');
    }
    if (!/[0-9]/.test(password)) {
      throw new BadRequestException('A senha deve conter pelo menos um número');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      throw new BadRequestException('A senha deve conter pelo menos um caractere especial');
    }
  }

  // -----------------------------------------------------------------------
  // Session helpers
  // -----------------------------------------------------------------------
  private async createSession(
    refreshToken: string,
    options: {
      userId?: string;
      platformAdminId?: string;
      activeCompanyId?: string;
    },
  ): Promise<void> {
    const refreshTokenHash = await argon2.hash(refreshToken);
    const payload = this.jwt.decode(refreshToken) as { exp: number } | null;

    await this.prisma.userSession.create({
      data: {
        userId: options.userId ?? null,
        platformAdminId: options.platformAdminId ?? null,
        activeCompanyId: options.activeCompanyId ?? null,
        refreshTokenHash,
        expiresAt: payload?.exp ? new Date(payload.exp * 1000) : new Date(Date.now() + 30 * 864e5),
      },
    });
  }

  /**
   * Rotaciona o refresh token:
   *  - Verifica o JWT do refresh token
   *  - Procura a sessão cujo refreshTokenHash corresponda (argon2.verify)
   *  - Se a sessão já foi revogada → DETECÇÃO DE REUSO: revoga todas as
   *    sessões do mesmo admin/usuário
   *  - Revoga a sessão atual
   *  - Cria nova sessão com o novo refresh token
   */
  private async rotateSession(
    rawToken: string,
    secret: string,
    type: 'platform' | 'user',
  ): Promise<{ sub: string; tokens: TokenPair; sessionId: string }> {
    // 1. Verificar assinatura JWT
    const payload = this.jwt.verify<{ sub: string; type: string; exp: number }>(rawToken, { secret });

    if (payload.type !== type) {
      throw new UnauthorizedException('Tipo de token incompatível');
    }

    // 2. Buscar sessões ativas do subject
    const sessions = await this.prisma.userSession.findMany({
      where: {
        [type === 'platform' ? 'platformAdminId' : 'userId']: payload.sub,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Tentar encontrar a sessão que corresponde ao token (argon2.verify)
    let matchedSession: (typeof sessions)[number] | null = null;

    for (const session of sessions) {
      try {
        if (await argon2.verify(session.refreshTokenHash, rawToken)) {
          matchedSession = session;
          break;
        }
      } catch {
        // hash corrompido — continuar
      }
    }

    // Se não encontrou sessão correspondente
    if (!matchedSession) {
      // Pode ser um refresh token já rotacionado — verificar se alguma
      // sessão já revogada deste usuário corresponde (reuso)
      const revokedSessions = await this.prisma.userSession.findMany({
        where: {
          [type === 'platform' ? 'platformAdminId' : 'userId']: payload.sub,
          revokedAt: { not: null },
        },
      });

      for (const session of revokedSessions) {
        try {
          if (await argon2.verify(session.refreshTokenHash, rawToken)) {
            // REUSO DETECTADO! Revogar TODAS as sessões deste admin/usuário
            await this.prisma.userSession.updateMany({
              where: {
                [type === 'platform' ? 'platformAdminId' : 'userId']: payload.sub,
                revokedAt: null,
              },
              data: {
                revokedAt: new Date(),
                revocationReason: 'reuse_detected',
              },
            });
            throw new UnauthorizedException('Token reutilizado. Todas as sessões foram revogadas por segurança');
          }
        } catch {
          // continuar
        }
      }

      throw new UnauthorizedException('Refresh token inválido ou já utilizado');
    }

    // 4. Criar novo par de tokens
    const tokens = type === 'platform'
      ? this.platformTokens(payload.sub)
      : this.userTokens(payload.sub, matchedSession.activeCompanyId ?? undefined);

    const refreshTokenHash = await argon2.hash(tokens.refreshToken);
    const newExp = this.jwt.decode(tokens.refreshToken) as { exp: number } | null;

    // 5. Transação: revogar antiga + criar nova sessão
    const [newSession] = await this.prisma.$transaction([
      this.prisma.userSession.create({
        data: {
          userId: type === 'user' ? payload.sub : null,
          platformAdminId: type === 'platform' ? payload.sub : null,
          activeCompanyId: matchedSession.activeCompanyId,
          refreshTokenHash,
          expiresAt: newExp?.exp ? new Date(newExp.exp * 1000) : new Date(Date.now() + 30 * 864e5),
        },
      }),
      this.prisma.userSession.update({
        where: { id: matchedSession.id },
        data: {
          lastUsedAt: new Date(),
          revokedAt: new Date(),
          revocationReason: 'rotated',
        },
      }),
    ]).catch(async (err) => {
      // Se a transação falhar (ex.: commit), ao menos registrar
      throw new InternalServerErrorException('Erro ao rotacionar sessão', err);
    });

    return { sub: payload.sub, tokens, sessionId: newSession.id };
  }

  private async revokeSession(
    adminIdOrUserId: string,
    type: 'platform' | 'user',
    sessionId?: string,
  ): Promise<void> {
    const field = type === 'platform' ? 'platformAdminId' : 'userId';
    const where: Prisma.UserSessionWhereInput = { [field]: adminIdOrUserId, revokedAt: null };

    if (sessionId) {
      where.id = sessionId;
    }

    await this.prisma.userSession.updateMany({
      where,
      data: { revokedAt: new Date(), revocationReason: 'logout' },
    });
  }

  // -----------------------------------------------------------------------
  // Platform Auth
  // -----------------------------------------------------------------------
  async platformLogin(email: string, password: string): Promise<PlatformLoginResult> {
    await this.ensureSeed();

    const admin = await this.prisma.platformAdmin.findUnique({ where: { email } });
    if (!admin || admin.status !== 'ACTIVE') {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!(await argon2.verify(admin.passwordHash, password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Atualizar lastLoginAt
    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = this.platformTokens(admin.id);
    await this.createSession(tokens.refreshToken, { platformAdminId: admin.id });

    return {
      admin: { id: admin.id, name: admin.name, email: admin.email },
      ...tokens,
    };
  }

  async platformRefresh(refreshToken: string): Promise<TokenPair> {
    const secret = process.env.PLATFORM_JWT_REFRESH_SECRET || 'dev-platform-refresh';
    const result = await this.rotateSession(refreshToken, secret, 'platform');
    return result.tokens;
  }

  async platformLogout(adminId: string, sessionId?: string): Promise<void> {
    await this.revokeSession(adminId, 'platform', sessionId);
  }

  async platformLogoutAll(adminId: string): Promise<void> {
    await this.revokeSession(adminId, 'platform');
  }

  // -----------------------------------------------------------------------
  // User Auth
  // -----------------------------------------------------------------------
  async userLogin(email: string, password: string): Promise<UserLoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Usuário inativo');
    }

    // Buscar o activeCompanyId — pegar a primeira empresa ativa do usuário
    const activeMember = await this.prisma.companyMember.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      orderBy: { isOwner: 'desc' },
    });

    const activeCompanyId: string | null = activeMember?.companyId ?? null;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = this.userTokens(user.id, activeCompanyId ?? undefined);
    await this.createSession(tokens.refreshToken, {
      userId: user.id,
      activeCompanyId: activeCompanyId ?? undefined,
    });

    return {
      user: { id: user.id, name: user.name, email: user.email },
      activeCompanyId,
      ...tokens,
    };
  }

  async userRefresh(refreshToken: string): Promise<TokenPair> {
    const secret = process.env.JWT_REFRESH_SECRET || 'dev-user-refresh';
    const result = await this.rotateSession(refreshToken, secret, 'user');
    return result.tokens;
  }

  async userLogout(userId: string, sessionId?: string): Promise<void> {
    await this.revokeSession(userId, 'user', sessionId);
  }

  async userLogoutAll(userId: string): Promise<void> {
    await this.revokeSession(userId, 'user');
  }

  // -----------------------------------------------------------------------
  // Invitation
  // -----------------------------------------------------------------------
  async acceptInvitation(
    token: string,
    password: string,
  ): Promise<AcceptInvitationResult> {
    // Buscar convites PENDING
    const invitations = await this.prisma.ownerInvitation.findMany({
      where: { acceptedAt: null },
    });

    // Tentar encontrar o convite cujo tokenHash corresponda
    let matchedInv: (typeof invitations)[number] | null = null;

    for (const inv of invitations) {
      try {
        if (await argon2.verify(inv.tokenHash, token)) {
          matchedInv = inv;
          break;
        }
      } catch {
        // continuar
      }
    }

    if (!matchedInv) {
      throw new BadRequestException('Convite inválido');
    }

    if (matchedInv.expiresAt < new Date()) {
      throw new BadRequestException('Convite expirado');
    }

    this.validatePassword(password);

    const passwordHash = await argon2.hash(password);

    // Transação: criar/atualizar User, criar CompanyMember, aceitar convite
    const result = await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: matchedInv!.email },
      });

      let userId: string;

      if (existingUser) {
        // Usuário já existe — atualizar senha e status
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            passwordHash,
            status: 'ACTIVE',
          },
        });
        userId = existingUser.id;
      } else {
        // Criar novo usuário
        const newUser = await tx.user.create({
          data: {
            name: matchedInv!.name,
            email: matchedInv!.email,
            passwordHash,
            status: 'ACTIVE',
            emailVerifiedAt: new Date(),
          },
        });
        userId = newUser.id;
      }

      // Verificar se já é membro da empresa
      const existingMember = await tx.companyMember.findUnique({
        where: {
          companyId_userId: {
            companyId: matchedInv!.companyId,
            userId,
          },
        },
      });

      if (!existingMember) {
        await tx.companyMember.create({
          data: {
            companyId: matchedInv!.companyId,
            userId,
            status: 'ACTIVE',
            isOwner: true,
            joinedAt: new Date(),
          },
        });
      } else if (existingMember.status !== 'ACTIVE') {
        await tx.companyMember.update({
          where: { id: existingMember.id },
          data: { status: 'ACTIVE', joinedAt: new Date() },
        });
      }

      // Marcar convite como aceito
      await tx.ownerInvitation.update({
        where: { id: matchedInv!.id },
        data: { acceptedAt: new Date() },
      });

      const user = await tx.user.findUnique({ where: { id: userId } })!;

      return { user: { id: userId, name: user!.name, email: user!.email }, companyId: matchedInv!.companyId };
    });

    const tokens = this.userTokens(result.user.id, result.companyId);
    await this.createSession(tokens.refreshToken, {
      userId: result.user.id,
      activeCompanyId: result.companyId,
    });

    return { ...result, ...tokens };
  }

  // -----------------------------------------------------------------------
  // Company switching
  // -----------------------------------------------------------------------
  async companies(userId: string): Promise<CompanyResult[]> {
    const members = await this.prisma.companyMember.findMany({
      where: { userId },
      include: { company: true },
    });

    return members.map((m) => ({
      company: {
        id: m.company.id,
        tradeName: m.company.tradeName,
        document: m.company.document,
      },
      member: { isOwner: m.isOwner, status: m.status },
    }));
  }

  async switchCompany(
    userId: string,
    companyId: string,
  ): Promise<TokenPair & { activeCompanyId: string }> {
    const member = await this.prisma.companyMember.findFirst({
      where: { userId, companyId, status: 'ACTIVE' },
    });

    if (!member) {
      throw new UnauthorizedException('Usuário sem vínculo ativo com a empresa');
    }

    const tokens = this.userTokens(userId, companyId);

    // Atualizar a última sessão ativa do usuário com o novo activeCompanyId
    await this.prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { activeCompanyId: companyId },
    });

    return { activeCompanyId: companyId, ...tokens };
  }
}
