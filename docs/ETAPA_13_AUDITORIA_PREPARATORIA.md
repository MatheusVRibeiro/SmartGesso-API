# ETAPA 13 — Auditoria Preparaatória: Feature Flags

> **Status:** AUDITÓRIA (nenhum arquivo alterado)
> **Data:** 24/08/2026
> **Repo:** SmartGesso-API
> **Base:** `docs/PLANO_REFATORACAO_BACKEND_V4.md` — ETAPA 13 (linhas 1408–1471)

---

## 1. Estado Atual

### 1.1. Prisma Schema — Model `Plan` (schema.prisma:187–202)

```prisma
model Plan {
  id                  String         @id @default(uuid()) @db.Char(36)
  name                String
  code                String         @unique
  description         String?        @db.Text
  billingType         BillingType
  defaultPrice        Decimal        @db.Decimal(15, 2)
  maxUsers            Int
  maxStorageMb        Int
  features            Json           // ← EXISTE (Json)
  showSmartGessoBrand Boolean        @default(true)
  status              PlanStatus     @default(ACTIVE)
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt
  subscriptions       Subscription[]
}
```

**Resposta direta:** Sim, existe o campo `features Json` no model `Plan`.

### 1.2. Domain type — `Plan` (domain.ts:47–59)

```typescript
export interface Plan {
  id: string;
  name: string;
  code: string;
  description?: string;
  billingType: BillingType;
  defaultPrice: string;
  maxUsers: number;
  maxStorageMb: number;
  features: string[];          // ← tratado como string[] no domínio
  showSmartGessoBrand: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}
```

### 1.3. DTOs — `CreatePlanDto` / `UpdatePlanDto`

- `create-plan.dto.ts:34` → `features?: string[]` (`@IsOptional() @IsArray()`)
- `update-plan.dto.ts` → `PartialType(CreatePlanDto)` (herda `features?: string[]`)

### 1.4. BusinessService — manipulação de `features`

| Método | Linha | Observação |
|--------|-------|------------|
| `createPlan()` | 114–129 | Armazena `features` como `Prisma.InputJsonValue` (`(dto.features ?? []) as Prisma.InputJsonValue`) |
| `updatePlan()` | 141–159 | Atualiza `features` (`dto.features as Prisma.InputJsonValue`) |
| `accessStatus()` | 397–418 | Faz join `Company → Subscription → Plan` mas **não resolve features** |
| `listCompanySubscriptions()` | 200–207 | Inclui `plan: true` (retorna features do plano) |

### 1.5. Model `Company` e `CompanyBranding` (schema.prisma:89–185)

```prisma
model Company {
  // ...
  branding              CompanyBranding?
  subscriptions         Subscription[]
  // ...
}

model CompanyBranding {
  id                  String   @id @default(uuid()) @db.Char(36)
  companyId           String   @unique @db.Char(36)
  // ...
  showSmartGessoBrand Boolean  @default(true)
  // ...
}
```

**Resposta direta:** Não existe campo `features` (ou `featureOverrides`) no model `Company` ou `CompanyBranding`.

### 1.6. Padrão de override existente — `showSmartGessoBrand`

| Nível | Campo | Default | Local |
|-------|-------|---------|-------|
| Plano | `Plan.showSmartGessoBrand` | `true` | schema.prisma:197 |
| Empresa | `CompanyBranding.showSmartGessoBrand` | `true` | schema.prisma:181 |

Este é o **precedente direto** para o padrão "plano + override de empresa" que a ETAPA 13 precisa seguir. O mesmo padrão já é implementado em:
- `BusinessService.createCompany()` (linha 50): `showSmartGessoBrand: dto.branding?.showSmartGessoBrand ?? true`
- `BusinessService.updateCompany()` (linha 155): `showSmartGessoBrand: dto.showSmartGessoBrand`
- `BusinessService.branding()` (linha 442): `showSmartGessoBrand: dto.showSmartGessoBrand`
- `UpdateBrandingDto` (linha 59): `showSmartGessoBrand?: boolean`

### 1.7. Sistema de permissões (role-based) — NÃO é feature flag

- **`company-permissions.ts`** (core): `ROLE_PERMISSIONS` — matriz de permissões por perfil (`COMPANY_OWNER`, `MANAGER`, `SALES`, `FINANCE`, `INSTALLER`, `PRODUCTION`). Funções helper: `permissionsForRole()`, `roleHasPermission()`, `memberHasPermission()`, `roleHasAllPermissions()`.
- **`permissions.guard.ts`**: Valida `req.member.permissions` contra `@RequirePermissions(...)`.
- **`active-company.guard.ts`**: Popula `req.company` e `req.member` (com `permissions` derivadas do role).
- **`company-access.guard.ts`**: Verifica status da assinatura (bloqueia se expirada/suspensa).

**Importante:** `@RequirePermissions` é definido (`common/decorators/require-permissions.decorator.ts`) mas **não é usado em nenhum controller**. O `PermissionsGuard` retorna `true` quando não há permissões requeridas (`if (!required.length) return true`). Portanto, o sistema de permissões existe como infraestrutura mas não está ativamente enforçado em rotas.

### 1.8. Módulos relevantes

| Módulo | Arquivos | Observação |
|--------|----------|------------|
| `plans` | `plans.controller.ts`, `plans.module.ts`, `dto/*` | Controller protegido por `PlatformAdminGuard`. CRUD de planos via `BusinessService`. |
| `companies` | `companies.controller.ts`, `companies.module.ts`, `dto/*` | Controller protegido por `JwtAuthGuard` + `ActiveCompanyGuard`. Endpoints: `access-status`, `permissions`, `profile`, `branding`. |
| `platform-companies` | `platform-companies.controller.ts`, `dto/*` | CRUD de empresas por admin da plataforma. |
| `subscriptions` | `subscriptions.controller.ts`, `dto/*` | Gestão de assinaturas por admin da plataforma. |
| `core` | `guards/*`, `services/*`, `company-permissions.ts` | Guards e permissões centralizados. `CoreModule` é `@Global()`. |

### 1.9. Contexto de request

```
JwtAuthGuard → req.user, req.companyId
ActiveCompanyGuard → req.company, req.member { ...member, permissions }
CompanyAccessGuard → valida subscription (bloqueia se expirada)
PermissionsGuard → valida @RequirePermissions (não usado em rotas ainda)
```

Decorators existentes: `CurrentCompany` (extrai `req.company`), `CurrentUser` (extrai `req.user`).

### 1.10. Seed

`prisma/seed.ts` — apenas cria um `PlatformAdmin`. **Nenhum plano ou feature é semeado.**

---

## 2. Como features/planos funcionam hoje

### 2.1. Relacionamento

```
Company ──< Subscription >── Plan
```

- Uma empresa tem várias assinaturas (histórico).
- Cada assinatura referencia um plano.
- O plano contém `features: Json` (array de strings no domínio).

### 2.2. Resolução de features

**Não existe resolução de features por empresa.** O `features` do plano é armazenado mas nunca resolvido para uma empresa específica. O único ponto de join `Company → Subscription → Plan` está em:

- `BusinessService.accessStatus()` — retorna `planName`, `endDate`, `accessStatus`, mas **não retorna features**.
- `BusinessService.listCompanySubscriptions()` — inclui `plan: true` (retorna features do plano bruto).

### 2.3. Flow atual de acesso

1. Usuário autentica → `JwtAuthGuard` define `req.user` + `req.companyId`.
2. `ActiveCompanyGuard` busca `CompanyMember` + `Company`, define `req.company` + `req.member.permissions` (do role).
3. `CompanyAccessGuard` verifica se a assinatura está ativa (não expirada/suspensa).
4. `PermissionsGuard` valida permissões de role (não usado em rotas ainda).

**Nenhum passo verifica feature flags.**

---

## 3. Modelo Sugerido para ETAPA 13

### 3.1. Regra de resolução (conforme especificação V4)

```
EffectiveFeatures = Plan.features (base) + Company overrides (override)
```

- **Base:** `features` do plano associado à assinatura ativa da empresa.
- **Override:** campo `features` (ou `featureOverrides`) no nível da empresa, que pode habilitar/desabilitar features individualmente.
- **Resolução:** merge — features do plano são a base; overrides da empresa podem remover (desabilitar) ou adicionar (habilitar) features.

### 3.2. Schema — opções

#### Opção A (recomendada): Adicionar `features` ao `CompanyBranding`

```prisma
model CompanyBranding {
  // ... campos existentes ...
  features Json?   // override de features por empresa (null = usa do plano)
}
```

**Prós:**
- Reutiliza tabela existente (menos migrações).
- Siga o mesmo padrão de `showSmartGessoBrand` (plano + empresa).
- `CompanyBranding` já tem relação 1:1 com `Company`.

**Contras:**
- Acopla features a branding (semanticamente não ideal).

#### Opção B: Novo model `CompanyFeatureOverride`

```prisma
model CompanyFeatureOverride {
  companyId String @id @db.Char(36)
  features  Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  company   Company  @relation(fields: [companyId], references: [id])
}
```

**Prós:**
- Separação clara de responsabilidades.
- Mais explícito.

**Contras:**
- Migração adicional.
- Nova tabela para poucos campos.

#### Opção C: Campo `features` direto no `Company`

```prisma
model Company {
  // ...
  features Json?   // override de features
}
```

**Prós:**
- Simples, direto.

**Contras:**
- Mistura configuração de acesso com dados corporativos.

### 3.3. Tipo de feature

Definir um tipo/enum para as features conhecidas:

```typescript
// src/modules/core/features.ts (ou src/domain.ts)
export const FEATURE_FLAGS = [
  'production',
  'inventory',
  'purchases',
  'team',
  'advancedFinance',
  'warranty',
  'pushNotifications',
  'customBranding',
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];
```

### 3.4. Service de resolução

Novo serviço em `src/modules/core/services/company-features.service.ts`:

```typescript
@Injectable()
export class CompanyFeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve features efetivas para uma empresa:
   * Plan.features (base) + Company overrides
   */
  async effectiveFeatures(companyId: string): Promise<string[]> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    const planFeatures = (subscription?.plan?.features as string[] | null) ?? [];
    const companyOverrides = await this.prisma.companyBranding.findFirst({
      where: { companyId },
      select: { features: true },
    });

    const overrides = (companyOverrides?.features as Record<string, boolean> | null) ?? {};

    // Merge: plan features como base, overrides da empresa aplicam
    return planFeatures.filter((f) => overrides[f] !== false);
  }
}
```

### 3.5. Guard de feature

Novo guard `src/modules/core/guards/feature.guard.ts` + decorator `@RequireFeature()`:

```typescript
// decorator
export const RequireFeature = (...features: FeatureFlag[]) =>
  SetMetadata(FEATURES_KEY, features);

// guard
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly featuresService: CompanyFeaturesService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<FeatureFlag[]>(FEATURES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]) ?? [];

    if (!required.length) return true;

    const req = ctx.switchToHttp().getRequest();
    const companyId = req.company?.id;
    if (!companyId) throw new ForbiddenException('Contexto de empresa não disponível');

    const effective = await this.featuresService.effectiveFeatures(companyId);
    const missing = required.filter((f) => !effective.includes(f));
    if (missing.length) throw new ForbiddenException(`Feature(s) desabilitada(s): ${missing.join(', ')}`);

    return true;
  }
}
```

### 3.6. Integração no `ActiveCompanyGuard`

População de `req.company.features` (effective features) no `ActiveCompanyGuard`, similar a como `req.member.permissions` é populado hoje:

```typescript
// active-company.guard.ts — após definir req.company
const effectiveFeatures = await this.featuresService.effectiveFeatures(company.id);
req.company = { ...company, features: effectiveFeatures };
```

### 3.7. Endpoint

```
GET /companies/current/features
```

No `companies.controller.ts`:

```typescript
@Get('features')
features(@Req() r: any) {
  return this.biz.effectiveFeatures(r.company.id);
}
```

### 3.8. Proteção de endpoints

Aplicar `@UseGuards(FeatureGuard)` + `@RequireFeature('production')` em controllers de módulos opcionais:
- `production-orders` → `@RequireFeature('production')`
- `inventory` → `@RequireFeature('inventory')`
- `purchases` (nova) → `@RequireFeature('purchases')`
- `company-members` → `@RequireFeature('team')`
- `expenses` (financeiro avançado) → `@RequireFeature('advancedFinance')`
- `service-orders` (garantia) → `@RequireFeature('warranty')`
- `notifications` (push) → `@RequireFeature('pushNotifications')`
- `companies/branding` → `@RequireFeature('customBranding')`

---

## 4. Onde Implementar (roadmap de arquivos)

### 4.1. Schema
| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | Adicionar `features Json?` a `CompanyBranding` (Opção A) ou novo model (Opção B) |
| `prisma/migrations/0010_add_company_features` | Nova migration |

### 4.2. Domínio
| Arquivo | Ação |
|---------|------|
| `src/domain.ts` | Adicionar `FeatureFlag` type, `features?: string[]` a `Branding` |
| `src/modules/core/features.ts` | Novo — constante `FEATURE_FLAGS` e tipo |

### 4.3. Core (serviço + guard + decorator)
| Arquivo | Ação |
|---------|------|
| `src/modules/core/services/company-features.service.ts` | Novo — resolução de `EffectiveFeatures` |
| `src/modules/core/guards/feature.guard.ts` | Novo — `FeatureGuard` |
| `src/common/decorators/require-feature.decorator.ts` | Novo — `@RequireFeature()` |
| `src/modules/core/core.module.ts` | Registrar `CompanyFeaturesService` e `FeatureGuard` |

### 4.4. Guards existentes
| Arquivo | Ação |
|---------|------|
| `src/modules/core/guards/active-company.guard.ts` | Popular `req.company.features` (effective) |
| `src/modules/core/guards/company-access.guard.ts` | (Opcional) bloquear se assinatura não tem acesso a feature |

### 4.5. BusinessService
| Arquivo | Ação |
|---------|------|
| `src/business.service.ts` | Adicionar `effectiveFeatures(companyId)` (ou delegar ao novo service) |

### 4.6. Controllers
| Arquivo | Ação |
|---------|------|
| `src/modules/companies/companies.controller.ts` | Adicionar `GET /features` |
| `src/modules/plans/dto/create-plan.dto.ts` | (Opcional) validar `features` contra `FEATURE_FLAGS` |
| Módulos de production/inventory/etc. | Adicionar `@UseGuards(FeatureGuard)` + `@RequireFeature(...)` |

### 4.7. DTOs
| Arquivo | Ação |
|---------|------|
| `src/modules/companies/dto/update-branding.dto.ts` | Adicionar `features?: Record<string, boolean>` (override) |

---

## 5. Decisões Pendentes (para validar antes da implementação)

1. **Onde armazenar overrides de empresa?**
   - Opção A: `CompanyBranding.features` (menos migrações, segue padrão `showSmartGessoBrand`)
   - Opção B: novo model `CompanyFeatureOverride` (mais limpo semanticamente)

2. **Formato do override:**
   - `Json` como `Record<string, boolean>` (ex: `{ "production": false, "inventory": true }`)
   - Ou `string[]` (lista de features habilitadas, ignorando plano)

3. **Quem resolve features — BusinessService ou novo service?**
   - ETAPA 14 planeja eliminar `BusinessService`. Sugere-se novo `CompanyFeaturesService` em `core/`.

4. **Cache de features efetivas:**
   - Resolver a cada request (simples, mas query extra) ou cachear em `req.company` no `ActiveCompanyGuard`.

5. **Override pode habilitar feature não presente no plano?**
   - Regra atual sugere "plano + overrides" — overrides apenas desabilitam. Confirmar se overrides podem habilitar.

---

## 6. Resumo Executivo

| Pergunta | Resposta |
|----------|----------|
| Existe campo `features` no `Plan`? | **Sim** — `features Json` em schema.prisma:196, tratado como `string[]` em domain.ts e DTOs |
| Existe override de features por empresa? | **Não** — `Company` e `CompanyBranding` não têm campo de features |
| Como features/planos funcionam hoje? | `Plan.features` é armazenado mas nunca resolvido para empresa. Join `Company → Subscription → Plan` existe apenas em `accessStatus()` e `listCompanySubscriptions()` |
| Padrão de override existente? | Sim — `showSmartGessoBrand` em `Plan` + `CompanyBranding` (precedente direto) |
| Sistema de permissões? | Role-based (`ROLE_PERMISSIONS`), não feature-based. `@RequirePermissions` definido mas não usado em rotas |
| Onde adicionar `EffectiveFeatures`? | Novo `CompanyFeaturesService` em `core/services/` + popular em `ActiveCompanyGuard` |
| Features iniciais? | `production`, `inventory`, `purchases`, `team`, `advancedFinance`, `warranty`, `pushNotifications`, `customBranding` |
| Endpoint proposto? | `GET /companies/current/features` |
| Arquivo alterado? | **Nenhum** — auditoria apenas |
