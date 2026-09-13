import { ForbiddenException, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthController } from '../src/modules/auth/auth.controller';
import { PermissionsGuard } from '../src/modules/core/guards/permissions.guard';
import { CompanyAccessGuard } from '../src/modules/core/guards/company-access.guard';
import { permissionsForRole } from '../src/modules/core/company-permissions';

/**
 * ETAPA 5 (V5) — /auth/me expõe role+permissions e códigos de erro
 * padronizados nos guards.
 *
 * PrismaService é mockado — nenhum banco é acessado.
 */

// ─────────────────────────────────────────────────────────────────────────
// GET /auth/me — role + permissions do membro ativo
// ─────────────────────────────────────────────────────────────────────────

describe('AuthController.me (V5 ETAPA 5)', () => {
  const auth = new AuthController({} as any);

  it('retorna role+permissions quando req.member está populado (ActiveCompanyGuard)', () => {
    const member = {
      role: 'COMPANY_OWNER',
      permissions: permissionsForRole('COMPANY_OWNER'),
    };
    const result = auth.me({
      user: { id: 'u1', name: 'Ana', email: 'ana@teste.local' },
      companyId: 'company-1',
      member,
    } as any);

    expect(result).toEqual({
      id: 'u1',
      name: 'Ana',
      email: 'ana@teste.local',
      activeCompanyId: 'company-1',
      role: 'COMPANY_OWNER',
      permissions: member.permissions,
    });
    expect(result.permissions.length).toBeGreaterThan(0);
  });

  it('retorna role SALES com permissões derivadas do role (role restrito)', () => {
    const result = auth.me({
      user: { id: 'u2', name: 'Bob', email: 'bob@teste.local' },
      companyId: 'company-1',
      member: { role: 'SALES', permissions: permissionsForRole('SALES') },
    } as any);

    expect(result.role).toBe('SALES');
    expect(result.permissions).toEqual(permissionsForRole('SALES'));
    expect(result.permissions).toContain('company.read');
    expect(result.permissions).not.toContain('quotes.approve');
    expect(result.permissions).not.toContain('members.invite');
  });

  it('retorna role null e permissions [] quando member ausente (compat)', () => {
    const result = auth.me({
      user: { id: 'u3', name: 'Carol', email: 'carol@teste.local' },
      companyId: null,
    } as any);

    expect(result).toEqual({
      id: 'u3',
      name: 'Carol',
      email: 'carol@teste.local',
      activeCompanyId: null,
      role: null,
      permissions: [],
    });
  });

  it('NUNCA inventa COMPANY_OWNER quando member ausente', () => {
    const result = auth.me({
      user: { id: 'u4', name: 'Dan', email: 'dan@teste.local' },
      companyId: 'company-1',
    } as any);

    expect(result.role).toBeNull();
    expect(result.permissions).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// PermissionsGuard — ForbiddenException com code 'FORBIDDEN'
// ─────────────────────────────────────────────────────────────────────────

describe('PermissionsGuard (V5 ETAPA 5)', () => {
  function makeCtx(required: string[], memberPermissions: string[]) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const req = { member: { permissions: memberPermissions } };
    const ctx = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => req }),
    };
    return { guard, ctx };
  }

  it('passa quando não há permissões exigidas na rota', () => {
    const { guard, ctx } = makeCtx([], []);
    expect(guard.canActivate(ctx as any)).toBe(true);
  });

  it('passa quando o member tem todas as permissões exigidas', () => {
    const { guard, ctx } = makeCtx(['clients.read', 'quotes.read'], [
      'clients.read',
      'quotes.read',
      'quotes.create',
    ]);
    expect(guard.canActivate(ctx as any)).toBe(true);
  });

  it('lança ForbiddenException com code FORBIDDEN quando falta permissão', () => {
    const { guard, ctx } = makeCtx(['quotes.approve'], ['quotes.read']);
    try {
      guard.canActivate(ctx as any);
      fail('deveria ter lançado ForbiddenException');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const response = (err as ForbiddenException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('FORBIDDEN');
      expect(response.statusCode).toBe(403);
      expect(response.message).toBe('Permissão insuficiente');
    }
  });

  it('trata member ausente como sem permissões (lança FORBIDDEN)', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['clients.read']),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const ctx = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({}) }), // sem req.member
    };
    try {
      guard.canActivate(ctx as any);
      fail('deveria ter lançado ForbiddenException');
    } catch (err) {
      const response = (err as ForbiddenException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('FORBIDDEN');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// CompanyAccessGuard — códigos de erro padronizados
// ─────────────────────────────────────────────────────────────────────────

describe('CompanyAccessGuard (V5 ETAPA 5)', () => {
  const FUTURE = new Date(Date.now() + 30 * 864e5);
  const PAST = new Date(Date.now() - 864e5);

  function makeGuard(subscription: unknown) {
    const prisma = {
      subscription: { findFirst: jest.fn().mockResolvedValue(subscription) },
    };
    return { guard: new CompanyAccessGuard(prisma as any), prisma };
  }

  function makeCtx(req: unknown) {
    return { switchToHttp: () => ({ getRequest: () => req }) } as any;
  }

  it('lança COMPANY_ACCESS_DENIED (403) quando não há empresa ativa selecionada', async () => {
    const { guard } = makeGuard(null);
    try {
      await guard.canActivate(makeCtx({ company: undefined }));
      fail('deveria ter lançado HttpException');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const response = (err as HttpException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('COMPANY_ACCESS_DENIED');
      expect((err as HttpException).getStatus()).toBe(403);
    }
  });

  it('passa quando empresa e assinatura estão válidas', async () => {
    const { guard } = makeGuard({
      status: 'ACTIVE',
      endDate: FUTURE,
      gracePeriodEnd: null,
    });
    await expect(
      guard.canActivate(makeCtx({ company: { id: 'c1', status: 'ACTIVE', tradeName: 'Gesso' } })),
    ).resolves.toBe(true);
  });

  it('lança COMPANY_ACCESS_SUSPENDED (402) quando assinatura expirou', async () => {
    const { guard } = makeGuard({
      status: 'ACTIVE',
      endDate: PAST,
      gracePeriodEnd: null,
    });
    try {
      await guard.canActivate(
        makeCtx({ company: { id: 'c1', status: 'ACTIVE', tradeName: 'Gesso' } }),
      );
      fail('deveria ter lançado HttpException');
    } catch (err) {
      const response = (err as HttpException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('COMPANY_ACCESS_SUSPENDED');
      expect((err as HttpException).getStatus()).toBe(402);
    }
  });

  it('lança COMPANY_ACCESS_SUSPENDED quando grace period expirou', async () => {
    const { guard } = makeGuard({
      status: 'ACTIVE',
      endDate: PAST,
      gracePeriodEnd: PAST,
    });
    try {
      await guard.canActivate(
        makeCtx({ company: { id: 'c1', status: 'ACTIVE', tradeName: 'Gesso' } }),
      );
      fail('deveria ter lançado HttpException');
    } catch (err) {
      const response = (err as HttpException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('COMPANY_ACCESS_SUSPENDED');
    }
  });

  it('lança COMPANY_ACCESS_SUSPENDED quando endDate expirou, mesmo com grace válido (semântica atual: isExpired bloqueia independentemente do grace)', async () => {
    const { guard } = makeGuard({
      status: 'ACTIVE',
      endDate: PAST,
      gracePeriodEnd: FUTURE,
    });
    try {
      await guard.canActivate(
        makeCtx({ company: { id: 'c1', status: 'ACTIVE', tradeName: 'Gesso' } }),
      );
      fail('deveria ter lançado HttpException');
    } catch (err) {
      const response = (err as HttpException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('COMPANY_ACCESS_SUSPENDED');
      expect((err as HttpException).getStatus()).toBe(402);
    }
  });

  it('lança COMPANY_ACCESS_SUSPENDED quando não há assinatura', async () => {
    const { guard } = makeGuard(null);
    try {
      await guard.canActivate(
        makeCtx({ company: { id: 'c1', status: 'ACTIVE', tradeName: 'Gesso' } }),
      );
      fail('deveria ter lançado HttpException');
    } catch (err) {
      const response = (err as HttpException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('COMPANY_ACCESS_SUSPENDED');
      expect((err as HttpException).getStatus()).toBe(402);
    }
  });

  it('lança COMPANY_ACCESS_SUSPENDED quando empresa está SUSPENDED', async () => {
    const { guard } = makeGuard({ status: 'ACTIVE', endDate: FUTURE });
    try {
      await guard.canActivate(
        makeCtx({ company: { id: 'c1', status: 'SUSPENDED', tradeName: 'Gesso' } }),
      );
      fail('deveria ter lançado HttpException');
    } catch (err) {
      const response = (err as HttpException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('COMPANY_ACCESS_SUSPENDED');
    }
  });
});
