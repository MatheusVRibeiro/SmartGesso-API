import { CompanyUserRole } from '@prisma/client';

/**
 * Matriz de permissões por perfil (V3 — seção 57: Usuários e permissões).
 *
 * Perfis: COMPANY_OWNER (OWNER), MANAGER, SALES, FINANCE, INSTALLER, PRODUCTION.
 * Convenção de códigos segue src/domain.ts (ex.: clients.read, quotes.create).
 *
 * ESTA É A ÚNICA fonte de verdade para permissões de role.
 * - ActiveCompanyGuard popula `req.member.permissions` via `permissionsForRole`.
 * - PermissionsGuard valida `req.member.permissions` contra @RequirePermissions.
 * - company-members.service também usa `permissionsForRole` para expor ao cliente.
 *
 * Evite duplicar listas de permissões em outros arquivos (ex.: OWNER_PERMISSIONS
 * em domain.ts foi removido em favor desta matriz central).
 */
export const ROLE_PERMISSIONS: Record<CompanyUserRole, string[]> = {
  // COMPANY_OWNER = OWNER — acesso total à empresa
  COMPANY_OWNER: [
    'company.read',
    'company.update',
    'company.branding.read',
    'company.branding.update',
    'members.read',
    'members.invite',
    'members.update',
    'members.disable',
    'clients.read',
    'clients.create',
    'clients.update',
    'clients.archive',
    'catalog.read',
    'catalog.create',
    'catalog.update',
    'measurements.read',
    'measurements.create',
    'measurements.update',
    'compositions.read',
    'compositions.create',
    'compositions.update',
    'quotes.read',
    'quotes.create',
    'quotes.update',
    'quotes.approve',
    'quotes.cancel',
    'quotes.discount',
    'quotes.view_cost',
    'quotes.generate_pdf',
    'services.read',
    'services.create',
    'services.update',
    'services.complete',
    'production.read',
    'production.create',
    'production.update',
    'customer_payments.read',
    'customer_payments.create',
    'customer_payments.reverse',
    'customer_collections.read',
    'customer_collections.create',
    'expenses.read',
    'expenses.create',
    'expenses.update',
    'inventory.read',
    'inventory.create',
    'inventory.adjust',
    'reports.read',
    'reports.export',
  ],
  MANAGER: [
    'company.read',
    'company.update',
    'company.branding.read',
    'company.branding.update',
    'members.read',
    'members.invite',
    'members.update',
    'members.disable',
    'clients.read',
    'clients.create',
    'clients.update',
    'clients.archive',
    'catalog.read',
    'catalog.create',
    'catalog.update',
    'measurements.read',
    'measurements.create',
    'measurements.update',
    'compositions.read',
    'compositions.create',
    'compositions.update',
    'quotes.read',
    'quotes.create',
    'quotes.update',
    'quotes.approve',
    'quotes.cancel',
    'quotes.discount',
    'quotes.view_cost',
    'quotes.generate_pdf',
    'services.read',
    'services.create',
    'services.update',
    'services.complete',
    'production.read',
    'production.create',
    'production.update',
    'customer_payments.read',
    'customer_payments.create',
    'customer_payments.reverse',
    'customer_collections.read',
    'customer_collections.create',
    'expenses.read',
    'expenses.create',
    'expenses.update',
    'inventory.read',
    'inventory.create',
    'inventory.adjust',
    'reports.read',
    'reports.export',
  ],
  SALES: [
    'company.read',
    'members.read',
    'clients.read',
    'clients.create',
    'clients.update',
    'measurements.read',
    'measurements.create',
    'quotes.read',
    'quotes.create',
    'quotes.update',
    'quotes.discount',
    'quotes.generate_pdf',
    'services.read',
    'services.update',
    'reports.read',
  ],
  FINANCE: [
    'company.read',
    'members.read',
    'clients.read',
    'quotes.read',
    'quotes.view_cost',
    'customer_payments.read',
    'customer_payments.create',
    'customer_payments.reverse',
    'customer_collections.read',
    'customer_collections.create',
    'expenses.read',
    'expenses.create',
    'expenses.update',
    'reports.read',
    'reports.export',
  ],
  INSTALLER: [
    'company.read',
    'members.read',
    'clients.read',
    'measurements.read',
    'measurements.create',
    'measurements.update',
    'services.read',
    'services.update',
    'services.complete',
    'production.read',
    'production.update',
    'inventory.read',
    'inventory.adjust',
  ],
  PRODUCTION: [
    'company.read',
    'members.read',
    'clients.read',
    'compositions.read',
    'compositions.create',
    'compositions.update',
    'production.read',
    'production.create',
    'production.update',
    'services.read',
    'inventory.read',
    'inventory.create',
    'inventory.adjust',
    'reports.read',
  ],
};

/**
 * Alias semântico: OWNER é o mesmo perfil que COMPANY_OWNER no enum Prisma.
 * Útil para consumidores que referem-se ao perfil pelo nome conceitual.
 */
export const OWNER: CompanyUserRole = 'COMPANY_OWNER';

/**
 * Lista de perfis considerados "OWNER" (acesso total à empresa).
 */
export const OWNER_ROLES: CompanyUserRole[] = [OWNER];

/**
 * Lista de perfis considerados "gerenciais" (OWNER + MANAGER).
 */
export const MANAGEMENT_ROLES: CompanyUserRole[] = [OWNER, 'MANAGER'];

/**
 * Retorna a lista de permissões de um perfil (vazio se perfil desconhecido).
 */
export function permissionsForRole(role: CompanyUserRole): string[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Verifica se um perfil possui uma permissão específica.
 */
export function roleHasPermission(
  role: CompanyUserRole,
  permission: string,
): boolean {
  return permissionsForRole(role).includes(permission);
}

/**
 * Verifica se uma lista de permissões (ex.: req.member.permissions) contém
 * uma permissão específica.
 */
export function memberHasPermission(
  memberPermissions: readonly string[],
  permission: string,
): boolean {
  return memberPermissions.includes(permission);
}

/**
 * Verifica se um perfil possui TODAS as permissões exigidas.
 */
export function roleHasAllPermissions(
  role: CompanyUserRole,
  permissions: readonly string[],
): boolean {
  return permissions.every((p) => roleHasPermission(role, p));
}
