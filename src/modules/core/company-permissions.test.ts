import { CompanyUserRole } from '@prisma/client';
import {
  ROLE_PERMISSIONS,
  OWNER,
  OWNER_ROLES,
  MANAGEMENT_ROLES,
  permissionsForRole,
  roleHasPermission,
  memberHasPermission,
  roleHasAllPermissions,
} from './company-permissions';

/**
 * Testes da matriz de permissões centralizada (V3 — seção 57).
 *
 * Garantem que a matriz ROLE_PERMISSIONS seja a única fonte de verdade e que
 * cada perfil (SALES, FINANCE, INSTALLER, MANAGER, OWNER) respeite as
 * restrições de segurança definidas no contexto SmartGesso.
 */
describe('company-permissions (matriz centralizada)', () => {
  // ---------------------------------------------------------------------------
  // 1. Cobertura de perfis
  // ---------------------------------------------------------------------------
  describe('matriz cobre todos os perfis do enum CompanyUserRole', () => {
    const ALL_ROLES: CompanyUserRole[] = [
      'COMPANY_OWNER',
      'MANAGER',
      'SALES',
      'FINANCE',
      'INSTALLER',
      'PRODUCTION',
    ];

    it.each(ALL_ROLES)('ROLE_PERMISSIONS[%s] está definido', (role) => {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    });

    it('não há perfis no enum que estejam ausentes da matriz', () => {
      const enumValues = Object.values(CompanyUserRole) as CompanyUserRole[];
      enumValues.forEach((role) => {
        expect(ROLE_PERMISSIONS[role]).toBeDefined();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 2. OWNER (COMPANY_OWNER) — acesso total
  // ---------------------------------------------------------------------------
  describe('OWNER (COMPANY_OWNER) — acesso total', () => {
    const OWNER_PERMISSIONS = permissionsForRole(OWNER);

    it('OWNER é um alias válido para COMPANY_OWNER', () => {
      expect(OWNER).toBe('COMPANY_OWNER');
      expect(OWNER_ROLES).toContain(OWNER);
    });

    it('OWNER tem todas as permissões definidas na matriz', () => {
      const allPermissions = new Set<string>();
      Object.values(ROLE_PERMISSIONS).forEach((perms) =>
        perms.forEach((p) => allPermissions.add(p)),
      );
      allPermissions.forEach((permission) => {
        expect(OWNER_PERMISSIONS).toContain(permission);
      });
    });

    it('OWNER pode lançar despesa (expenses.create)', () => {
      expect(roleHasPermission(OWNER, 'expenses.create')).toBe(true);
    });

    it('OWNER pode alterar orçamento (quotes.update)', () => {
      expect(roleHasPermission(OWNER, 'quotes.update')).toBe(true);
    });

    it('OWNER pode ver custos (quotes.view_cost)', () => {
      expect(roleHasPermission(OWNER, 'quotes.view_cost')).toBe(true);
    });

    it('OWNER pode aprovar orçamento (quotes.approve)', () => {
      expect(roleHasPermission(OWNER, 'quotes.approve')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. MANAGER — acesso total (equivalente ao OWNER)
  // ---------------------------------------------------------------------------
  describe('MANAGER — acesso total conforme matriz', () => {
    const MANAGER_PERMISSIONS = permissionsForRole('MANAGER');

    it('MANAGER está na lista de roles gerenciais', () => {
      expect(MANAGEMENT_ROLES).toContain('MANAGER');
    });

    it('MANAGER tem todas as permissões do OWNER', () => {
      const ownerPerms = permissionsForRole(OWNER);
      ownerPerms.forEach((permission) => {
        expect(MANAGER_PERMISSIONS).toContain(permission);
      });
    });

    it('MANAGER pode lançar despesa (expenses.create)', () => {
      expect(roleHasPermission('MANAGER', 'expenses.create')).toBe(true);
    });

    it('MANAGER pode alterar orçamento (quotes.update)', () => {
      expect(roleHasPermission('MANAGER', 'quotes.update')).toBe(true);
    });

    it('MANAGER pode ver custos (quotes.view_cost)', () => {
      expect(roleHasPermission('MANAGER', 'quotes.view_cost')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. SALES — NÃO lança despesa
  // ---------------------------------------------------------------------------
  describe('SALES — não lança despesa', () => {
    const SALES_PERMISSIONS = permissionsForRole('SALES');

    it('SALES NÃO tem expenses.create (não lança despesa)', () => {
      expect(roleHasPermission('SALES', 'expenses.create')).toBe(false);
    });

    it('SALES NÃO tem expenses.read (não vê despesas)', () => {
      expect(roleHasPermission('SALES', 'expenses.read')).toBe(false);
    });

    it('SALES NÃO tem expenses.update (não altera despesa)', () => {
      expect(roleHasPermission('SALES', 'expenses.update')).toBe(false);
    });

    it('SALES NÃO tem quotes.view_cost (não vê custos)', () => {
      expect(roleHasPermission('SALES', 'quotes.view_cost')).toBe(false);
    });

    it('SALES NÃO tem quotes.approve (não aprova orçamento)', () => {
      expect(roleHasPermission('SALES', 'quotes.approve')).toBe(false);
    });

    it('SALES NÃO tem quotes.cancel (não cancela orçamento)', () => {
      expect(roleHasPermission('SALES', 'quotes.cancel')).toBe(false);
    });

    it('SALES NÃO tem inventory.create (não cria estoque)', () => {
      expect(roleHasPermission('SALES', 'inventory.create')).toBe(false);
    });

    it('SALES NÃO tem inventory.adjust (não ajusta estoque)', () => {
      expect(roleHasPermission('SALES', 'inventory.adjust')).toBe(false);
    });

    it('SALES NÃO tem production.* (não acessa produção)', () => {
      expect(roleHasPermission('SALES', 'production.read')).toBe(false);
      expect(roleHasPermission('SALES', 'production.create')).toBe(false);
      expect(roleHasPermission('SALES', 'production.update')).toBe(false);
    });

    it('SALES NÃO tem customer_payments.* (não acessa pagamentos)', () => {
      expect(roleHasPermission('SALES', 'customer_payments.read')).toBe(false);
      expect(roleHasPermission('SALES', 'customer_payments.create')).toBe(false);
    });

    it('SALES NÃO tem customer_collections.* (não acessa recebimentos)', () => {
      expect(roleHasPermission('SALES', 'customer_collections.read')).toBe(false);
    });

    it('SALES NÃO tem catalog.* (não gerencia catálogo)', () => {
      expect(roleHasPermission('SALES', 'catalog.create')).toBe(false);
      expect(roleHasPermission('SALES', 'catalog.update')).toBe(false);
    });

    it('SALES NÃO tem compositions.* (não acessa composições)', () => {
      expect(roleHasPermission('SALES', 'compositions.read')).toBe(false);
    });

    it('SALES NÃO tem services.create (não cria serviços)', () => {
      expect(roleHasPermission('SALES', 'services.create')).toBe(false);
    });

    it('SALES NÃO tem services.complete (não completa serviços)', () => {
      expect(roleHasPermission('SALES', 'services.complete')).toBe(false);
    });

    it('SALES NÃO tem members.invite (não convida membros)', () => {
      expect(roleHasPermission('SALES', 'members.invite')).toBe(false);
    });

    it('SALES NÃO tem members.disable (não desativa membros)', () => {
      expect(roleHasPermission('SALES', 'members.disable')).toBe(false);
    });

    it('SALES NÃO tem company.update (não altera empresa)', () => {
      expect(roleHasPermission('SALES', 'company.update')).toBe(false);
    });

    it('SALES NÃO tem company.branding.update (não altera branding)', () => {
      expect(roleHasPermission('SALES', 'company.branding.update')).toBe(false);
    });

    it('SALES NÃO tem reports.export (não exporta relatórios)', () => {
      expect(roleHasPermission('SALES', 'reports.export')).toBe(false);
    });

    it('SALES tem quotes.discount (pode conceder desconto no orçamento)', () => {
      expect(roleHasPermission('SALES', 'quotes.discount')).toBe(true);
    });

    it('SALES tem acesso básico de leitura e vendas', () => {
      expect(SALES_PERMISSIONS).toContain('company.read');
      expect(SALES_PERMISSIONS).toContain('clients.read');
      expect(SALES_PERMISSIONS).toContain('clients.create');
      expect(SALES_PERMISSIONS).toContain('clients.update');
      expect(SALES_PERMISSIONS).toContain('quotes.read');
      expect(SALES_PERMISSIONS).toContain('quotes.create');
      expect(SALES_PERMISSIONS).toContain('quotes.update');
      expect(SALES_PERMISSIONS).toContain('quotes.generate_pdf');
      expect(SALES_PERMISSIONS).toContain('services.read');
      expect(SALES_PERMISSIONS).toContain('services.update');
      expect(SALES_PERMISSIONS).toContain('reports.read');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. FINANCE — NÃO altera orçamento
  // ---------------------------------------------------------------------------
  describe('FINANCE — não altera orçamento', () => {
    const FINANCE_PERMISSIONS = permissionsForRole('FINANCE');

    it('FINANCE NÃO tem quotes.update (não altera orçamento)', () => {
      expect(roleHasPermission('FINANCE', 'quotes.update')).toBe(false);
    });

    it('FINANCE NÃO tem quotes.create (não cria orçamento)', () => {
      expect(roleHasPermission('FINANCE', 'quotes.create')).toBe(false);
    });

    it('FINANCE NÃO tem quotes.approve (não aprova orçamento)', () => {
      expect(roleHasPermission('FINANCE', 'quotes.approve')).toBe(false);
    });

    it('FINANCE NÃO tem quotes.cancel (não cancela orçamento)', () => {
      expect(roleHasPermission('FINANCE', 'quotes.cancel')).toBe(false);
    });

    it('FINANCE NÃO tem quotes.discount (não concede desconto)', () => {
      expect(roleHasPermission('FINANCE', 'quotes.discount')).toBe(false);
    });

    it('FINANCE NÃO tem quotes.generate_pdf (não gera PDF de orçamento)', () => {
      expect(roleHasPermission('FINANCE', 'quotes.generate_pdf')).toBe(false);
    });

    it('FINANCE NÃO tem services.* (não acessa serviços)', () => {
      expect(roleHasPermission('FINANCE', 'services.read')).toBe(false);
      expect(roleHasPermission('FINANCE', 'services.create')).toBe(false);
    });

    it('FINANCE NÃO tem measurements.* (não acessa medições)', () => {
      expect(roleHasPermission('FINANCE', 'measurements.read')).toBe(false);
    });

    it('FINANCE NÃO tem catalog.* (não gerencia catálogo)', () => {
      expect(roleHasPermission('FINANCE', 'catalog.create')).toBe(false);
    });

    it('FINANCE NÃO tem compositions.* (não acessa composições)', () => {
      expect(roleHasPermission('FINANCE', 'compositions.read')).toBe(false);
    });

    it('FINANCE NÃO tem production.* (não acessa produção)', () => {
      expect(roleHasPermission('FINANCE', 'production.read')).toBe(false);
    });

    it('FINANCE NÃO tem inventory.create (não cria estoque)', () => {
      expect(roleHasPermission('FINANCE', 'inventory.create')).toBe(false);
    });

    it('FINANCE NÃO tem inventory.adjust (não ajusta estoque)', () => {
      expect(roleHasPermission('FINANCE', 'inventory.adjust')).toBe(false);
    });

    it('FINANCE NÃO tem members.invite (não convida membros)', () => {
      expect(roleHasPermission('FINANCE', 'members.invite')).toBe(false);
    });

    it('FINANCE NÃO tem members.disable (não desativa membros)', () => {
      expect(roleHasPermission('FINANCE', 'members.disable')).toBe(false);
    });

    it('FINANCE NÃO tem company.update (não altera empresa)', () => {
      expect(roleHasPermission('FINANCE', 'company.update')).toBe(false);
    });

    it('FINANCE NÃO tem company.branding.update (não altera branding)', () => {
      expect(roleHasPermission('FINANCE', 'company.branding.update')).toBe(false);
    });

    it('FINANCE tem acesso a finanças e leitura de orçamento', () => {
      expect(FINANCE_PERMISSIONS).toContain('expenses.read');
      expect(FINANCE_PERMISSIONS).toContain('expenses.create');
      expect(FINANCE_PERMISSIONS).toContain('expenses.update');
      expect(FINANCE_PERMISSIONS).toContain('customer_payments.read');
      expect(FINANCE_PERMISSIONS).toContain('customer_payments.create');
      expect(FINANCE_PERMISSIONS).toContain('customer_payments.reverse');
      expect(FINANCE_PERMISSIONS).toContain('customer_collections.read');
      expect(FINANCE_PERMISSIONS).toContain('customer_collections.create');
      expect(FINANCE_PERMISSIONS).toContain('quotes.read');
      expect(FINANCE_PERMISSIONS).toContain('quotes.view_cost');
      expect(FINANCE_PERMISSIONS).toContain('reports.read');
      expect(FINANCE_PERMISSIONS).toContain('reports.export');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. INSTALLER — NÃO vê custos
  // ---------------------------------------------------------------------------
  describe('INSTALLER — não vê custos', () => {
    const INSTALLER_PERMISSIONS = permissionsForRole('INSTALLER');

    it('INSTALLER NÃO tem quotes.view_cost (não vê custos)', () => {
      expect(roleHasPermission('INSTALLER', 'quotes.view_cost')).toBe(false);
    });

    it('INSTALLER NÃO tem quotes.read (não acessa orçamentos)', () => {
      expect(roleHasPermission('INSTALLER', 'quotes.read')).toBe(false);
    });

    it('INSTALLER NÃO tem quotes.create (não cria orçamento)', () => {
      expect(roleHasPermission('INSTALLER', 'quotes.create')).toBe(false);
    });

    it('INSTALLER NÃO tem quotes.update (não altera orçamento)', () => {
      expect(roleHasPermission('INSTALLER', 'quotes.update')).toBe(false);
    });

    it('INSTALLER NÃO tem expenses.* (não acessa despesas)', () => {
      expect(roleHasPermission('INSTALLER', 'expenses.read')).toBe(false);
      expect(roleHasPermission('INSTALLER', 'expenses.create')).toBe(false);
      expect(roleHasPermission('INSTALLER', 'expenses.update')).toBe(false);
    });

    it('INSTALLER NÃO tem customer_payments.* (não acessa pagamentos)', () => {
      expect(roleHasPermission('INSTALLER', 'customer_payments.read')).toBe(false);
    });

    it('INSTALLER NÃO tem customer_collections.* (não acessa recebimentos)', () => {
      expect(roleHasPermission('INSTALLER', 'customer_collections.read')).toBe(false);
    });

    it('INSTALLER NÃO tem catalog.* (não gerencia catálogo)', () => {
      expect(roleHasPermission('INSTALLER', 'catalog.read')).toBe(false);
    });

    it('INSTALLER NÃO tem compositions.* (não acessa composições)', () => {
      expect(roleHasPermission('INSTALLER', 'compositions.read')).toBe(false);
    });

    it('INSTALLER NÃO tem reports.* (não acessa relatórios)', () => {
      expect(roleHasPermission('INSTALLER', 'reports.read')).toBe(false);
      expect(roleHasPermission('INSTALLER', 'reports.export')).toBe(false);
    });

    it('INSTALLER NÃO tem members.invite (não convida membros)', () => {
      expect(roleHasPermission('INSTALLER', 'members.invite')).toBe(false);
    });

    it('INSTALLER NÃO tem members.disable (não desativa membros)', () => {
      expect(roleHasPermission('INSTALLER', 'members.disable')).toBe(false);
    });

    it('INSTALLER NÃO tem company.update (não altera empresa)', () => {
      expect(roleHasPermission('INSTALLER', 'company.update')).toBe(false);
    });

    it('INSTALLER NÃO tem company.branding.update (não altera branding)', () => {
      expect(roleHasPermission('INSTALLER', 'company.branding.update')).toBe(false);
    });

    it('INSTALLER tem measurements.create (cria medições de instalação)', () => {
      expect(roleHasPermission('INSTALLER', 'measurements.create')).toBe(true);
    });

    it('INSTALLER tem acesso operacional de instalação', () => {
      expect(INSTALLER_PERMISSIONS).toContain('company.read');
      expect(INSTALLER_PERMISSIONS).toContain('members.read');
      expect(INSTALLER_PERMISSIONS).toContain('clients.read');
      expect(INSTALLER_PERMISSIONS).toContain('measurements.read');
      expect(INSTALLER_PERMISSIONS).toContain('measurements.create');
      expect(INSTALLER_PERMISSIONS).toContain('measurements.update');
      expect(INSTALLER_PERMISSIONS).toContain('services.read');
      expect(INSTALLER_PERMISSIONS).toContain('services.update');
      expect(INSTALLER_PERMISSIONS).toContain('services.complete');
      expect(INSTALLER_PERMISSIONS).toContain('production.read');
      expect(INSTALLER_PERMISSIONS).toContain('production.update');
      expect(INSTALLER_PERMISSIONS).toContain('inventory.read');
      expect(INSTALLER_PERMISSIONS).toContain('inventory.adjust');
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Funções helper
  // ---------------------------------------------------------------------------
  describe('permissionsForRole', () => {
    it('retorna as permissões do COMPANY_OWNER', () => {
      const perms = permissionsForRole('COMPANY_OWNER');
      expect(perms).toEqual(ROLE_PERMISSIONS.COMPANY_OWNER);
      expect(perms.length).toBeGreaterThan(0);
    });

    it('retorna as permissões do SALES', () => {
      const perms = permissionsForRole('SALES');
      expect(perms).toEqual(ROLE_PERMISSIONS.SALES);
      expect(perms.length).toBeGreaterThan(0);
    });

    it('retorna as permissões do FINANCE', () => {
      const perms = permissionsForRole('FINANCE');
      expect(perms).toEqual(ROLE_PERMISSIONS.FINANCE);
      expect(perms.length).toBeGreaterThan(0);
    });

    it('retorna as permissões do INSTALLER', () => {
      const perms = permissionsForRole('INSTALLER');
      expect(perms).toEqual(ROLE_PERMISSIONS.INSTALLER);
      expect(perms.length).toBeGreaterThan(0);
    });

    it('retorna as permissões do MANAGER', () => {
      const perms = permissionsForRole('MANAGER');
      expect(perms).toEqual(ROLE_PERMISSIONS.MANAGER);
      expect(perms.length).toBeGreaterThan(0);
    });

    it('retorna as permissões do PRODUCTION', () => {
      const perms = permissionsForRole('PRODUCTION');
      expect(perms).toEqual(ROLE_PERMISSIONS.PRODUCTION);
      expect(perms.length).toBeGreaterThan(0);
    });
  });

  describe('roleHasPermission', () => {
    it('retorna true quando o role tem a permissão', () => {
      expect(roleHasPermission('COMPANY_OWNER', 'expenses.create')).toBe(true);
      expect(roleHasPermission('MANAGER', 'quotes.update')).toBe(true);
      expect(roleHasPermission('FINANCE', 'expenses.create')).toBe(true);
      expect(roleHasPermission('SALES', 'quotes.create')).toBe(true);
      expect(roleHasPermission('INSTALLER', 'services.complete')).toBe(true);
    });

    it('retorna false quando o role NÃO tem a permissão', () => {
      expect(roleHasPermission('SALES', 'expenses.create')).toBe(false);
      expect(roleHasPermission('FINANCE', 'quotes.update')).toBe(false);
      expect(roleHasPermission('INSTALLER', 'quotes.view_cost')).toBe(false);
    });
  });

  describe('memberHasPermission', () => {
    it('verifica permissões em uma lista de member.permissions', () => {
      const perms = permissionsForRole('SALES');
      expect(memberHasPermission(perms, 'quotes.read')).toBe(true);
      expect(memberHasPermission(perms, 'expenses.create')).toBe(false);
    });

    it('funciona com listas readonly', () => {
      const readonlyPerms: readonly string[] = ['a.read', 'b.create'];
      expect(memberHasPermission(readonlyPerms, 'a.read')).toBe(true);
      expect(memberHasPermission(readonlyPerms, 'c.delete')).toBe(false);
    });
  });

  describe('roleHasAllPermissions', () => {
    it('retorna true quando o role tem todas as permissões exigidas', () => {
      expect(
        roleHasAllPermissions('COMPANY_OWNER', [
          'expenses.create',
          'quotes.update',
          'quotes.view_cost',
        ]),
      ).toBe(true);
    });

    it('retorna false quando o role falta uma permissão', () => {
      expect(
        roleHasAllPermissions('SALES', [
          'quotes.create',
          'expenses.create',
        ]),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Consistência: OWNER e MANAGER têm o mesmo conjunto de permissões
  // ---------------------------------------------------------------------------
  describe('consistência OWNER = MANAGER', () => {
    it('OWNER e MANAGER têm exatamente as mesmas permissões', () => {
      const ownerPerms = permissionsForRole(OWNER).sort();
      const managerPerms = permissionsForRole('MANAGER').sort();
      expect(ownerPerms).toEqual(managerPerms);
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Segurança: nenhum role tem acesso a tudo (exceto OWNER/MANAGER)
  // ---------------------------------------------------------------------------
  describe('isolamento de permissões entre roles', () => {
    it('SALES não pode lançar despesa, mas FINANCE pode', () => {
      expect(roleHasPermission('SALES', 'expenses.create')).toBe(false);
      expect(roleHasPermission('FINANCE', 'expenses.create')).toBe(true);
    });

    it('FINANCE não altera orçamento, mas SALES pode', () => {
      expect(roleHasPermission('FINANCE', 'quotes.update')).toBe(false);
      expect(roleHasPermission('SALES', 'quotes.update')).toBe(true);
    });

    it('INSTALLER não vê custos, mas FINANCE pode', () => {
      expect(roleHasPermission('INSTALLER', 'quotes.view_cost')).toBe(false);
      expect(roleHasPermission('FINANCE', 'quotes.view_cost')).toBe(true);
    });

    it('INSTALLER não lança despesa, mas FINANCE pode', () => {
      expect(roleHasPermission('INSTALLER', 'expenses.create')).toBe(false);
      expect(roleHasPermission('FINANCE', 'expenses.create')).toBe(true);
    });

    it('SALES não vê custos, mas OWNER pode', () => {
      expect(roleHasPermission('SALES', 'quotes.view_cost')).toBe(false);
      expect(roleHasPermission(OWNER, 'quotes.view_cost')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 10. Role matrix — invariants (V5 — recomendação 4)
  // ---------------------------------------------------------------------------
  describe('Role matrix — invariants', () => {
    const OPERATIONAL_ROLES: CompanyUserRole[] = [
      'SALES',
      'FINANCE',
      'INSTALLER',
      'PRODUCTION',
    ];

    // (a) Hierarquia: COMPANY_OWNER ⊇ MANAGER ⊇ cada role operacional
    it('hierarquia: COMPANY_OWNER tem TODAS as permissões de MANAGER', () => {
      const ownerPerms = new Set(permissionsForRole(OWNER));
      permissionsForRole('MANAGER').forEach((permission) => {
        expect(ownerPerms.has(permission)).toBe(true);
      });
    });

    it.each(OPERATIONAL_ROLES)(
      'hierarquia: MANAGER tem TODAS as permissões de %s',
      (role) => {
        const managerPerms = new Set(permissionsForRole('MANAGER'));
        permissionsForRole(role).forEach((permission) => {
          expect(managerPerms.has(permission)).toBe(true);
        });
      },
    );

    // (b) SALES — vende orçamentos, não mexe em finanças nem em membros
    it('SALES tem quotes.create e quotes.read', () => {
      expect(roleHasPermission('SALES', 'quotes.create')).toBe(true);
      expect(roleHasPermission('SALES', 'quotes.read')).toBe(true);
    });

    it('SALES NÃO tem expenses.create nem members.invite', () => {
      expect(roleHasPermission('SALES', 'expenses.create')).toBe(false);
      expect(roleHasPermission('SALES', 'members.invite')).toBe(false);
    });

    // (c) FINANCE — finanças completas, mas não cria orçamento
    it('FINANCE tem expenses.read, expenses.create e customer_payments.read', () => {
      expect(roleHasPermission('FINANCE', 'expenses.read')).toBe(true);
      expect(roleHasPermission('FINANCE', 'expenses.create')).toBe(true);
      expect(roleHasPermission('FINANCE', 'customer_payments.read')).toBe(true);
    });

    it('FINANCE NÃO tem quotes.create', () => {
      expect(roleHasPermission('FINANCE', 'quotes.create')).toBe(false);
    });

    // (d) INSTALLER / PRODUCTION — chão de fábrica, não aprovam orçamento
    it.each(['INSTALLER', 'PRODUCTION'] as CompanyUserRole[])(
      '%s tem production.read mas NÃO tem quotes.approve',
      (role) => {
        expect(roleHasPermission(role, 'production.read')).toBe(true);
        expect(roleHasPermission(role, 'quotes.approve')).toBe(false);
      },
    );

    // (e) Nenhum role tem permissão vazia (lista vazia ou código vazio)
    it('nenhum role tem lista de permissões vazia ou código vazio', () => {
      const enumValues = Object.values(CompanyUserRole) as CompanyUserRole[];
      enumValues.forEach((role) => {
        const perms = permissionsForRole(role);
        expect(perms.length).toBeGreaterThan(0);
        perms.forEach((permission) => {
          expect(permission.trim().length).toBeGreaterThan(0);
        });
      });
    });

    // (f) Nenhum código de permissão duplicado dentro do mesmo role
    it('nenhum role tem código de permissão duplicado', () => {
      const enumValues = Object.values(CompanyUserRole) as CompanyUserRole[];
      enumValues.forEach((role) => {
        const perms = permissionsForRole(role);
        const unique = new Set(perms);
        expect(unique.size).toBe(perms.length);
      });
    });
  });
});
