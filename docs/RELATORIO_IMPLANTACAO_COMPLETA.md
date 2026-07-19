# Relatório Completo de Implementação — SmartGesso API

> **Gerado em:** 19/07/2026  
> **Projeto:** `smartgesso-api`  
> **Stack:** NestJS 11 + TypeScript estrito + Prisma ORM + MySQL + JWT/Argon2id  
> **Idioma:** PT-BR  
> **Fuso:** America/Sao_Paulo | **Moeda:** BRL

---

## Sumário

- [Resumo Executivo](#resumo-executivo)
- [O que já está implementado](#o-que-já-está-implementado)
- [Estrutura geral do produto](#estrutura-geral-do-produto)
- [Fase 0 — Fundação ✅ (concluída)](#fase-0--fundação--concluída)
- [Fase 1 — Plataforma + Autenticação ⚠️ (80%)](#fase-1--plataforma--autenticação-⚠️-80)
- [Fase 2 — Modularização + Persistência Real](#fase-2--modularização--persistência-real)
- [Fase 3 — Clientes, Catálogo e Obras](#fase-3--clientes-catálogo-e-obras)
- [Fase 4 — Medições e Ambientes](#fase-4--medições-e-ambientes)
- [Fase 5 — Cálculo Automático de Materiais](#fase-5--cálculo-automático-de-materiais)
- [Fase 6 — Orçamentos e PDF](#fase-6--orçamentos-e-pdf)
- [Fase 7 — Produção e Serviços](#fase-7--produção-e-serviços)
- [Fase 8 — Financeiro da Empresa](#fase-8--financeiro-da-empresa)
- [Fase 9 — Estoque e Relatórios](#fase-9--estoque-e-relatórios)
- [Fase 10 — Deploy, Documentação e Validação Final](#fase-10--deploy-documentação-e-validação-final)
- [Resumo de Agentes por Fase](#resumo-de-agentes-por-fase)
- [Definição de Done](#definição-de-done)

---

## Resumo Executivo

O **SmartGesso** é um SaaS multiempresa para gestão de empresas de gesso e drywall. A API backend (`smartgesso-api`) será consumida por dois frontends futuros: `smartgesso-mobile` (app dos gesseiros) e `smartgesso-admin-web` (painel do proprietário da plataforma).

**Status atual:** Stage 1 ≈ 80% concluído — scaffold NestJS funcional, schema Prisma completo, lógica de negócio parcialmente migrada para Prisma, mas **autenticação e guards ainda rodam em memória**.

**Escopo total:** 11 fases | ~40 subfases | ~22 agents delegados | ~180 arquivos TypeScript estimados

---

## O que já está implementado

### ✅ Prisma Schema — Completo (16 models)

| Modelo | Descrição |
|--------|-----------|
| `PlatformAdmin` | Administradores da plataforma |
| `Company` | Empresas assinantes |
| `CompanyAddress` | Endereços das empresas |
| `CompanyBranding` | Marca/logo/dados comerciais |
| `Plan` | Planos comerciais |
| `Subscription` | Contratos de assinatura |
| `SubscriptionInstallment` | Mensalidades |
| `SubscriptionPayment` | Pagamentos de mensalidades |
| `SubscriptionHistory` | Histórico de transições |
| `User` | Usuários das empresas |
| `CompanyMember` | Vínculo usuário ↔ empresa |
| `Role` | Papéis/funções |
| `Permission` | Permissões |
| `MemberRole` | Associação membro ↔ papel |
| `RolePermission` | Associação papel ↔ permissão |
| `OwnerInvitation` | Convites de proprietário |
| `AuditLog` | Auditoria |

### ✅ BusinessService — Prisma nativo (449 linhas)

- CRUD completo: empresas, planos, assinaturas, mensalidades, pagamentos
- Transações Prisma para operações multi-tabela
- `PrismaRepositoryService` com helpers `money()` e `tenantScope()`

### ✅ Controllers — Monolítico (220 linhas em `controllers.ts`)

- `HealthController` — GET /health
- `PlatformAuthController` — login, refresh, logout, me
- `PlatformCompaniesController` — CRUD + suspend/reactivate/block + convites
- `PlansController` — CRUD planos
- `SubscriptionsController` — assinaturas, mensalidades, pagamentos
- `AuthController` — login mobile, aceitar convite, trocar empresa
- `CompanyController` — profile, branding, access-status, permissions

### ✅ Segurança base

- 5 guards: PlatformAdminGuard, JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard, PermissionsGuard
- Helmet, CORS, ValidationPipe, Swagger

### ✅ Testes (2 — ambos com MemoryStore)

- `test/app.spec.ts` — fluxo completo (admin → empresa → plano → assinatura → mensalidade → pagamento → convite → login → profile)
- `test/e2e/smartgesso.e2e-spec.ts` — isolamento multiempresa (Empresa A vs B)

### ⚠️ Documentação — Stubs de 8 linhas

- ARCHITECTURE.md, DATABASE.md, SECURITY.md, MULTITENANCY.md, SUBSCRIPTIONS.md, API.md — todos placeholders

---

## Estrutura geral do produto

```
smartgesso-api/                          ← API backend (este projeto)
├── src/
│   ├── main.ts                          ← ✅ Bootstrap NestJS
│   ├── app.module.ts                    ← ✅ Módulo raiz
│   ├── domain.ts                        ← ⚠️ Interfaces legado (MemoryStore)
│   ├── controllers.ts                   ← ⚠️ Monolítico — precisa modularizar
│   ├── auth.service.ts                  ← ❌ MemoryStore — migrar p/ Prisma
│   ├── business.service.ts              ← ✅ Prisma nativo
│   ├── security.ts                      ← ❌ Guards em MemoryStore
│   ├── common/                          ← ✅ Decorators, filters, middleware
│   ├── config/                          ← 🔲 Vazio — criar config module
│   ├── database/
│   │   ├── prisma.service.ts            ← ✅
│   │   ├── prisma.module.ts             ← ✅
│   │   ├── prisma-repository.service.ts ← ✅ Helpers
│   │   └── memory.store.ts              ← ❌ Será removido após migração
│   └── modules/                         ← ⚠️ Esqueletos vazios
│       ├── core/
│       ├── health/
│       ├── platform-auth/
│       ├── platform-companies/
│       ├── plans/
│       ├── subscriptions/
│       ├── auth/
│       └── companies/
├── prisma/
│   ├── schema.prisma                    ← ✅ 16 models
│   ├── migrations/                      ← 🔲 Pendente (sem DB real)
│   └── seed.ts                          ← ❌ Não criado
├── test/
│   ├── app.spec.ts                      ← ⚠️ MemoryStore
│   └── e2e/smartgesso.e2e-spec.ts       ← ⚠️ MemoryStore
├── docs/                                ← ⚠️ Stubs
├── scripts/                             ← 🔲 Vazio
└── package.json                         ← ✅ Completo

smartgesso-mobile/                       ← 🔲 Futuro (app React Native)
smartgesso-admin-web/                    ← 🔲 Futuro (painel web React)
```

---

## Fase 0 — Fundação ✅ (concluída)

Já implementado no Stage 1:

- [x] Projeto NestJS criado com `nest new`
- [x] TypeScript estrito configurado
- [x] Prisma ORM + MySQL configurado
- [x] Schema com 16 models
- [x] Helmet, CORS, ValidationPipe, Swagger
- [x] Rate limiting (ThrottlerModule)
- [x] Request ID middleware
- [x] Exception filter global
- [x] Prefixo `/api/v1`
- [x] `.env.example` com todas as variáveis

---

## Fase 1 — Plataforma + Autenticação ⚠️ (80%)

Já implementado:

- [x] BusinessService com Prisma (empresas, planos, assinaturas, mensalidades, pagamentos)
- [x] PrismaRepositoryService (money(), tenantScope())
- [x] Controllers esqueleto em controllers.ts
- [x] Guards esqueleto (5 guards)
- [x] AuthService (login, refresh, convite, troca empresa)
- [x] 2 testes com MemoryStore

**Falta concluir (etapa 2 do STAGE_2.md):**

- [ ] Migrar AuthService para Prisma
- [ ] Migrar Guards para Prisma
- [ ] Tabela de sessões (UserSession)
- [ ] Refresh token com rotação + hash real
- [ ] Convite com tokenHash real (argon2)
- [ ] Quebrar controllers.ts em módulos reais
- [ ] DTOs com class-validator/class-transformer
- [ ] prisma/seed.ts dedicado

---

## Fase 2 — Modularização + Persistência Real

> **Status:** 🔴 A FAZER — 8 subfases | 5 agents | ~25 arquivos

### Subfase 2A: Migrar AuthService para Prisma

**Arquivos:**
- `src/modules/auth/auth.service.ts` ← criar
- `src/modules/auth/auth.module.ts` ← atualizar
- `prisma/schema.prisma` ← adicionar model `UserSession`
- `src/auth.service.ts` ← remover após migração

**O que fazer:**
1. Adicionar model `UserSession` no schema:
```prisma
model UserSession {
  id               String   @id @default(uuid()) @db.Char(36)
  userId           String?  @db.Char(36)
  platformAdminId  String?  @db.Char(36)
  activeCompanyId  String?  @db.Char(36)
  refreshTokenHash String
  deviceId         String?
  deviceName       String?
  ipAddress        String?
  userAgent        String?
  expiresAt        DateTime
  lastUsedAt       DateTime?
  revokedAt        DateTime?
  revocationReason String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```
2. Criar `AuthService` real em `src/modules/auth/` com:
   - `platformLogin()` → busca PlatformAdmin no Prisma, verifica Argon2, cria sessão, retorna tokens
   - `platformRefresh()` → busca sessão por `refreshTokenHash`, verifica com Argon2, rotaciona
   - `platformLogout()` → revoga sessão
   - `platformLogoutAll()` → revoga todas as sessões do admin
   - `userLogin()` → busca User no Prisma, verifica, cria sessão
   - `acceptInvitation()` → busca convite por hash, cria User + CompanyMember em transação
   - `switchCompany()` → atualiza `activeCompanyId` na sessão
3. Implementar **detecção de reuso** de refresh token (se um token já usado for reenviado, revogar todas as sessões do usuário)
4. Remover `src/auth.service.ts` e `src/domain.ts` (interfaces legadas)

### Subfase 2B: Migrar Guards para Prisma

**Arquivos:**
- `src/modules/core/guards/platform-admin.guard.ts` ← criar
- `src/modules/core/guards/jwt-auth.guard.ts` ← criar
- `src/modules/core/guards/active-company.guard.ts` ← criar
- `src/modules/core/guards/company-access.guard.ts` ← criar
- `src/modules/core/guards/permissions.guard.ts` ← criar
- `src/security.ts` ← remover após migração
- `src/modules/core/core.module.ts` ← atualizar

**O que fazer:**
1. Cada guard passa a usar `PrismaService` em vez de `MemoryStore`
2. `PlatformAdminGuard` → busca PlatformAdmin + sessão ativa no Prisma
3. `JwtAuthGuard` → extrai payload do token, busca User no Prisma, carrega `activeCompanyId` da sessão
4. `ActiveCompanyGuard` → busca CompanyMember no Prisma com `userId + companyId`, verifica `status === 'ACTIVE'`
5. `CompanyAccessGuard` → busca última Subscription ativa no Prisma, verifica data de término + grace period
6. `PermissionsGuard` → busca MemberRole → RolePermission no Prisma (ou cache em req.member)

### Subfase 2C: Corrigir convite com tokenHash real

**Arquivos:**
- `src/business.service.ts` — método `inviteOwner()` e `acceptInvitation()`
- `prisma/schema.prisma` — model `OwnerInvitation`

**O que fazer:**
1. `inviteOwner()`:
   - Gerar token UUID puro → retornar no response (para o admin enviar ao proprietário)
   - Salvar `tokenHash = await argon2.hash(token)` no banco
   - **NUNCA** salvar token puro no banco
2. `acceptInvitation(token, password)`:
   - Buscar todas as invitations PENDING da empresa
   - Para cada uma, verificar `argon2.verify(inv.tokenHash, token)`
   - Validar expiração
   - Criar User + CompanyMember em transação

### Subfase 2D: Quebrar controllers.ts em módulos individuais

**Arquivos a criar (12 controllers):**
- `src/modules/health/health.controller.ts`
- `src/modules/platform-auth/platform-auth.controller.ts`
- `src/modules/platform-admins/platform-admins.controller.ts` ← NOVO
- `src/modules/platform-companies/platform-companies.controller.ts`
- `src/modules/plans/plans.controller.ts`
- `src/modules/subscriptions/subscriptions.controller.ts`
- `src/modules/subscription-installments/subscription-installments.controller.ts` ← NOVO
- `src/modules/subscription-payments/subscription-payments.controller.ts` ← NOVO
- `src/modules/auth/auth.controller.ts`
- `src/modules/companies/companies.controller.ts`
- `src/modules/company-members/company-members.controller.ts` ← NOVO
- `src/modules/invitations/invitations.controller.ts` ← NOVO

**Arquivos a modificar:**
- `src/controllers.ts` ← remover
- `src/app.module.ts` ← registrar novos módulos

**O que fazer:**
1. Mover cada bloco de rotas do `controllers.ts` para seu respectivo módulo
2. Cada controller usa os services do próprio módulo
3. `PlatformAdminsController` (novo): CRUD completo de administradores
4. `CompanyMembersController` (novo): gerenciar membros da empresa
5. `InvitationsController` (novo): reenviar/cancelar convites

### Subfase 2E: Criar DTOs para todos os endpoints

**Arquivos:** ~25 DTOs
- `src/modules/*/dto/create-*.dto.ts`
- `src/modules/*/dto/update-*.dto.ts`
- `src/modules/*/dto/*-response.dto.ts`

**O que fazer:**
1. Criar DTOs de entrada com `class-validator`:
   - `@IsString()`, `@IsEmail()`, `@IsOptional()`, `@IsEnum()`
   - `@IsDecimal({ decimal_digits: '2' })` para valores financeiros
   - `@Min(0)`, `@MaxLength()`, `@Matches()` para validação de documento
2. Criar DTOs de resposta com `class-transformer`:
   - `@Exclude()` para `passwordHash`
   - `@Transform()` para datas no fuso Brasil
3. Trocar todos os `any` nos parâmetros dos métodos dos controllers pelos DTOs específicos

### Subfase 2F: Criar módulo de auditoria funcional

**Arquivos:**
- `src/modules/audit/audit.service.ts` ← criar
- `src/modules/audit/audit.module.ts` ← criar

**O que fazer:**
1. Criar `AuditService` com método `log(action, entity, entityId, metadata, request?)`
2. Extrair do request: `companyId`, `userId`, `platformAdminId`, `ipAddress`, `userAgent`, `requestId`
3. Injetar nos pontos críticos:
   - Login/logout (plataforma e empresa)
   - Criação/alteração de empresa
   - Criação/alteração de plano
   - Criação/renovação/suspensão/reativação/cancelamento de contrato
   - Geração/pagamento/cancelamento de mensalidade
   - Convite e aceitação
   - Troca de empresa

### Subfase 2G: Criar prisma/seed.ts

**Arquivos:**
- `prisma/seed.ts` ← criar

**O que fazer:**
1. Seed idempotente (verifica se já existe antes de criar):
   - Permissões (todas as ~45 do domínio)
   - Roles (COMPANY_OWNER, MANAGER, SALES, FINANCE, INSTALLER, PRODUCTION)
   - RolePermission (associar permissões a cada role)
   - Planos (BASIC, PROFESSIONAL, BUSINESS)
   - Administrador padrão (usando variáveis de ambiente)
2. Recusar senha fraca no seed
3. Usar `prisma.$transaction` para consistência

### Subfase 2H: Migrar testes para Prisma

**Arquivos:**
- `test/app.spec.ts` ← reescrever
- `test/e2e/smartgesso.e2e-spec.ts` ← reescrever
- `test/factories/*.ts` ← criar
- `test/helpers/*.ts` ← criar
- `test/jest-e2e.json` ← criar/configurar

**O que fazer:**
1. Configurar `TEST_DATABASE_URL` no `.env`
2. Adicionar validação: se `NODE_ENV !== 'test'` e URL não contém `test`, abortar
3. Criar factories: `buildCompany()`, `buildPlan()`, `buildUser()`, etc.
4. Criar helper para reset do banco entre testes
5. Reescrever `app.spec.ts` com testes:
   - Admin login válido/inválido/bloqueado
   - Refresh com rotação
   - Logout/logout-all
   - Usuário empresarial NÃO acessa /platform
6. Reescrever `e2e.spec.ts` com testes:
   - Empresa A acessa A, não acessa B
   - Trocar UUID não permite acesso
   - Suspensão bloqueia operações
   - Usuário com 2 empresas acessa apenas a ativa
7. Remover `MemoryStore` dos testes

---

## Fase 3 — Clientes, Catálogo e Obras

> **Status:** 🔴 A FAZER — 4 subfases | 2 agents | ~20 arquivos

### Subfase 3A: Modelos de dados (Prisma)

**Adicionar ao schema:**
```prisma
model Customer {
  id          String          @id @default(uuid()) @db.Char(36)
  companyId   String          @db.Char(36)
  type        String          // PF | PJ
  name        String
  email       String?
  phone       String?
  whatsapp    String?
  document    String?         // CPF/CNPJ
  notes       String?         @db.Text
  origin      String?         // INDICATION | SOCIAL_MEDIA | WEBSITE | WALK_IN | OTHER
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  deletedAt   DateTime?
  company     Company         @relation(fields: [companyId], references: [id])
  addresses   CustomerAddress[]
  jobsites    Jobsite[]
  @@unique([companyId, document])
}

model CustomerAddress {
  id          String   @id @default(uuid()) @db.Char(36)
  customerId  String   @db.Char(36)
  type        String   // RESIDENTIAL | COMMERCIAL | BILLING
  postalCode  String?
  street      String
  number      String?
  complement  String?
  district    String
  city        String
  state       String
  country     String   @default("BR")
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  customer    Customer @relation(fields: [customerId], references: [id])
}

model Jobsite {
  id          String   @id @default(uuid()) @db.Char(36)
  companyId   String   @db.Char(36)
  customerId  String   @db.Char(36)
  name        String
  description String?  @db.Text
  postalCode  String?
  street      String
  number      String?
  complement  String?
  district    String
  city        String
  state       String
  country     String   @default("BR")
  notes       String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  customer    Customer @relation(fields: [customerId], references: [id])
  company     Company  @relation(fields: [companyId], references: [id])
  measurements Measurement[]
}

model Product {
  id          String   @id @default(uuid()) @db.Char(36)
  companyId   String   @db.Char(36)
  name        String
  description String?  @db.Text
  category    String?  // MATERIAL | FINISHED | RESALE | SERVICE
  unit        String   // UN | M2 | KG | L | PC
  costPrice   Decimal? @db.Decimal(15, 2)
  salePrice   Decimal? @db.Decimal(15, 2)
  minStock    Int?
  status      String   @default("ACTIVE") // ACTIVE | INACTIVE
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  company     Company  @relation(fields: [companyId], references: [id])
}

model Supplier {
  id          String   @id @default(uuid()) @db.Char(36)
  companyId   String   @db.Char(36)
  name        String
  email       String?
  phone       String?
  whatsapp    String?
  document    String?
  notes       String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  company     Company  @relation(fields: [companyId], references: [id])
}
```

**Arquivos:**
- `prisma/schema.prisma` ← adicionar 5 models
- `prisma/migrations/` ← criar migration

### Subfase 3B: Módulo de Clientes

**Arquivos:**
- `src/modules/customers/customers.module.ts`
- `src/modules/customers/customers.controller.ts`
- `src/modules/customers/customers.service.ts`
- `src/modules/customers/dto/create-customer.dto.ts`
- `src/modules/customers/dto/update-customer.dto.ts`
- `src/modules/customers/dto/customer-response.dto.ts`

**Endpoints (roteiro):**
```
GET    /customers              — Listar (com filtros: nome, documento, origem)
POST   /customers              — Criar
GET    /customers/:id          — Obter (com endereços e obras)
PATCH  /customers/:id          — Atualizar
DELETE /customers/:id          — Arquivar (soft delete)

POST   /customers/:id/addresses        — Criar endereço
GET    /customers/:id/addresses         — Listar endereços
PATCH  /customers/addresses/:id         — Atualizar endereço
DELETE /customers/addresses/:id         — Remover endereço
```

### Subfase 3C: Módulo de Obras (Jobsite)

**Arquivos:**
- `src/modules/jobsites/jobsites.module.ts`
- `src/modules/jobsites/jobsites.controller.ts`
- `src/modules/jobsites/jobsites.service.ts`
- `src/modules/jobsites/dto/*.ts`

**Endpoints:**
```
GET    /customers/:customerId/jobsites       — Listar obras do cliente
POST   /customers/:customerId/jobsites       — Criar obra
GET    /jobsites/:id                         — Obter obra
PATCH  /jobsites/:id                         — Atualizar
DELETE /jobsites/:id                         — Arquivar
```

### Subfase 3D: Módulo de Catálogo (Produtos + Fornecedores)

**Arquivos:**
- `src/modules/products/products.module.ts`
- `src/modules/products/products.controller.ts`
- `src/modules/products/products.service.ts`
- `src/modules/suppliers/suppliers.module.ts`
- `src/modules/suppliers/suppliers.controller.ts`
- `src/modules/suppliers/suppliers.service.ts`

**Endpoints:**
```
GET    /products              — Listar (filtros: categoria, status)
POST   /products              — Criar
GET    /products/:id          — Obter
PATCH  /products/:id          — Atualizar
DELETE /products/:id          — Desativar

GET    /suppliers             — Listar
POST   /suppliers             — Criar
GET    /suppliers/:id         — Obter
PATCH  /suppliers/:id         — Atualizar
```

---

## Fase 4 — Medições e Ambientes

> **Status:** 🔴 A FAZER — 2 subfases | 1 agent | ~12 arquivos

### Subfase 4A: Modelos de dados (Prisma)

```prisma
model Measurement {
  id          String   @id @default(uuid()) @db.Char(36)
  jobsiteId   String   @db.Char(36)
  companyId   String   @db.Char(36)
  name        String   // "Sala", "Quarto Principal", etc.
  length      Decimal? @db.Decimal(10, 2)
  width       Decimal? @db.Decimal(10, 2)
  height      Decimal? @db.Decimal(10, 2)
  area        Decimal? @db.Decimal(10, 2)
  perimeter   Decimal? @db.Decimal(10, 2)
  doors       Int?
  windows     Int?
  cutouts     String?  @db.Text  // JSON: [{x, y, w, h}]
  lightFixtures Int?
  coving      String?  // type of coving/sanca
  dropCeiling String?  @db.Text  // JSON: {area, height, type}
  notes       String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  jobsite     Jobsite  @relation(fields: [jobsiteId], references: [id])
  company     Company  @relation(fields: [companyId], references: [id])
  compositions CompositionItem[]
}
```

**Arquivos:**
- `prisma/schema.prisma` ← adicionar model
- `prisma/migrations/` ← migration

### Subfase 4B: Módulo de Medições

**Arquivos:**
- `src/modules/measurements/measurements.module.ts`
- `src/modules/measurements/measurements.controller.ts`
- `src/modules/measurements/measurements.service.ts`
- `src/modules/measurements/dto/*.ts`

**Endpoints:**
```
POST   /jobsites/:jobsiteId/measurements         — Criar medição
GET    /jobsites/:jobsiteId/measurements         — Listar
GET    /measurements/:id                         — Obter
PATCH  /measurements/:id                         — Atualizar
DELETE /measurements/:id                         — Remover
```

**Cálculos automáticos no service:**
- `area = length × width`
- `perimeter = 2 × (length + width)` (quando aplicável)
- Calcular área descontando portas/janelas

---

## Fase 5 — Cálculo Automático de Materiais

> **Status:** 🔴 A FAZER — 3 subfases | 2 agents | ~15 arquivos

### Subfase 5A: Modelos de dados

```prisma
model Composition {
  id           String             @id @default(uuid()) @db.Char(36)
  companyId    String             @db.Char(36)
  name         String
  description  String?            @db.Text
  version      Int                @default(1)
  isActive     Boolean            @default(true)
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt
  company      Company            @relation(fields: [companyId], references: [id])
  items        CompositionItem[]
}

model CompositionItem {
  id              String      @id @default(uuid()) @db.Char(36)
  compositionId   String      @db.Char(36)
  measurementId   String?     @db.Char(36)
  materialName    String
  unit            String      // UN | M2 | KG | L | PC
  quantityPerUnit Decimal     @db.Decimal(15, 4)
  wastePercent    Decimal?    @db.Decimal(5, 2)
  unitCost        Decimal?    @db.Decimal(15, 2)
  formula         String?     @db.Text  // JSON: tipo, parâmetros
  sortOrder       Int         @default(0)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  composition     Composition @relation(fields: [compositionId], references: [id])
  measurement     Measurement? @relation(fields: [measurementId], references: [id])
}
```

### Subfase 5B: Service de Cálculo

**Arquivos:**
- `src/modules/calculations/calculations.service.ts`
- `src/modules/calculations/calculations.controller.ts`

**Fórmulas a implementar:**

1. **Placas de drywall** (1,20m × 2,40m):
   ```
   placas = ceil(area / (1.20 * 2.40)) * (1 + perdaPercent/100)
   ```

2. **Guias** (perfil U — perímetro):
   ```
   guias = ceil(perimeter / 3.0) * (1 + perdaPercent/100)
   ```

3. **Montantes** (perfil C — espaçamento 400mm ou 600mm):
   ```
   montantes = ceil(length / spacing) + 1
   ```

4. **Parafusos**:
   ```
   parafusos = placas * 32  (aprox. 32 parafusos por placa)
   ```

5. **Fita de junta**:
   ```
   fitaMetros = perimeter * 1.1  (10% de perda)
   ```

6. **Massa para juntas**:
   ```
   massaKg = placas * 0.8  (aprox. 800g por placa)
   ```

**Regras:**
- Composições são versionadas e configuráveis por empresa
- Fórmulas podem ser substituídas por valores manuais
- Resultado do cálculo gera `QuoteItem` no orçamento

### Subfase 5C: Módulo de Composições

**Endpoints:**
```
GET    /compositions              — Listar composições ativas
POST   /compositions              — Criar composição
GET    /compositions/:id          — Obter com itens
PATCH  /compositions/:id          — Atualizar
POST   /compositions/:id/version  — Criar nova versão

POST   /calculations/drywall      — Calcular materiais (input: medidas + tipo)
```

---

## Fase 6 — Orçamentos e PDF

> **Status:** 🔴 A FAZER — 4 subfases | 2 agents | ~20 arquivos

### Subfase 6A: Modelos de dados

```prisma
model Quote {
  id              String    @id @default(uuid()) @db.Char(36)
  companyId       String    @db.Char(36)
  customerId      String    @db.Char(36)
  jobsiteId       String?   @db.Char(36)
  quoteNumber     Int       // sequencial por empresa
  version         Int       @default(1)
  status          String    @default("DRAFT") // DRAFT | SENT | APPROVED | REJECTED | CANCELLED
  totalCost       Decimal   @db.Decimal(15, 2)
  totalPrice      Decimal   @db.Decimal(15, 2)
  discountPercent Decimal?  @db.Decimal(5, 2)
  discountAmount  Decimal?  @db.Decimal(15, 2)
  finalPrice      Decimal   @db.Decimal(15, 2)
  marginPercent   Decimal?  @db.Decimal(5, 2)
  validUntil      DateTime?
  warrantyText    String?   @db.Text
  paymentTerms    String?   @db.Text
  notes           String?   @db.Text
  approvedAt      DateTime?
  rejectedAt      DateTime?
  rejectionReason String?   @db.Text
  pdfGeneratedAt  DateTime?
  snapshot        Json?     // Snapshot imutável dos dados usados no PDF
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  company         Company   @relation(fields: [companyId], references: [id])
  customer        Customer  @relation(fields: [customerId], references: [id])
  jobsite         Jobsite?  @relation(fields: [jobsiteId], references: [id])
  items           QuoteItem[]
}

model QuoteItem {
  id          String   @id @default(uuid()) @db.Char(36)
  quoteId     String   @db.Char(36)
  type        String   // PRODUCT | SERVICE | LABOR | TRANSPORT | DISCOUNT
  description String
  quantity    Decimal  @db.Decimal(10, 2)
  unit        String
  unitCost    Decimal? @db.Decimal(15, 2)
  unitPrice   Decimal  @db.Decimal(15, 2)
  totalPrice  Decimal  @db.Decimal(15, 2)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  quote       Quote    @relation(fields: [quoteId], references: [id])
}
```

### Subfase 6B: Módulo de Orçamentos

**Arquivos:**
- `src/modules/quotes/quotes.module.ts`
- `src/modules/quotes/quotes.controller.ts`
- `src/modules/quotes/quotes.service.ts`
- `src/modules/quotes/dto/*.ts`

**Endpoints:**
```
GET    /quotes — Listar (filtros: status, cliente, período)
POST   /quotes — Criar (com itens)
GET    /quotes/:id — Obter
PATCH  /quotes/:id — Atualizar
POST   /quotes/:id/approve — Aprovar
POST   /quotes/:id/reject — Rejeitar
POST   /quotes/:id/cancel — Cancelar
POST   /quotes/:id/new-version — Criar versão
GET    /quotes/:id/pdf — Gerar/baixar PDF
```

### Subfase 6C: Snapshot e versionamento

- Ao aprovar orçamento, gerar snapshot imutável dos dados
- Snapshot inclui: dados da empresa (branding), dados do cliente, itens, preços, condições
- Versões mantêm histórico: `version` incrementa, snapshot anterior preservado
- PDF antigo não é alterado quando dados mudam

### Subfase 6D: Geração de PDF

- Biblioteca: `pdfmake` ou `jspdf`
- Template profissional com logotipo, dados da empresa, cliente, itens
- Custos e margem NÃO aparecem no PDF do cliente
- Suporte a: desconto, condições de pagamento, garantia, observações
- Número sequencial por empresa

---

## Fase 7 — Produção e Serviços

> **Status:** 🔴 A FAZER — 3 subfases | 2 agents | ~15 arquivos

### Subfase 7A: Modelos de dados

```prisma
model ProductionOrder {
  id              String    @id @default(uuid()) @db.Char(36)
  companyId       String    @db.Char(36)
  quoteId         String?   @db.Char(36)
  productName     String
  quantity        Int
  quantityProduced Int      @default(0)
  quantityLost    Int       @default(0)
  status          String    @default("PENDING") // PENDING | IN_PROGRESS | COMPLETED | CANCELLED
  responsibleId   String?   @db.Char(36)
  startDate       DateTime?
  endDate         DateTime?
  notes           String?   @db.Text
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  company         Company   @relation(fields: [companyId], references: [id])
}

model ServiceOrder {
  id              String    @id @default(uuid()) @db.Char(36)
  companyId       String    @db.Char(36)
  quoteId         String?   @db.Char(36)
  jobsiteId       String?   @db.Char(36)
  customerId      String    @db.Char(36)
  status          String    @default("SCHEDULED") // SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED
  scheduledDate   DateTime?
  startDate       DateTime?
  endDate         DateTime?
  responsibleId   String?   @db.Char(36)
  teamMembers     Json?     // [{userId, name, role}]
  checklist       Json?     // [{item, checked, checkedAt, checkedBy}]
  photos          Json?     // [{url, caption, uploadedAt}]
  notes           String?   @db.Text
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  company         Company   @relation(fields: [companyId], references: [id])
  customer        Customer  @relation(fields: [customerId], references: [id])
}
```

### Subfase 7B: Módulo de Produção

**Endpoints:**
```
GET    /production-orders — Listar
POST   /production-orders — Criar (a partir de orçamento ou manual)
GET    /production-orders/:id — Obter
PATCH  /production-orders/:id — Atualizar
POST   /production-orders/:id/complete — Concluir
POST   /production-orders/:id/cancel — Cancelar
```

### Subfase 7C: Módulo de Serviços

**Endpoints:**
```
GET    /service-orders — Listar (filtros: status, data, responsável)
POST   /service-orders — Criar (a partir de orçamento)
GET    /service-orders/:id — Obter
PATCH  /service-orders/:id — Atualizar
POST   /service-orders/:id/start — Iniciar
POST   /service-orders/:id/complete — Concluir
POST   /service-orders/:id/cancel — Cancelar
POST   /service-orders/:id/checklist — Atualizar checklist
POST   /service-orders/:id/photos — Adicionar foto
```

---

## Fase 8 — Financeiro da Empresa

> **Status:** 🔴 A FAZER — 3 subfases | 2 agents | ~15 arquivos

### Subfase 8A: Modelos de dados

```prisma
model CustomerReceivable {
  id            String    @id @default(uuid()) @db.Char(36)
  companyId     String    @db.Char(36)
  serviceOrderId String?  @db.Char(36)
  quoteId       String?   @db.Char(36)
  customerId    String    @db.Char(36)
  description   String
  totalAmount   Decimal   @db.Decimal(15, 2)
  installments  Int       @default(1)
  status        String    @default("PENDING") // PENDING | PARTIALLY_PAID | PAID | OVERDUE | CANCELLED
  notes         String?   @db.Text
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  company       Company   @relation(fields: [companyId], references: [id])
  customer      Customer  @relation(fields: [customerId], references: [id])
  payments      CustomerPayment[]
}

model CustomerPayment {
  id                String    @id @default(uuid()) @db.Char(36)
  receivableId      String    @db.Char(36)
  companyId         String    @db.Char(36)
  installmentNumber Int       @default(1)
  amount            Decimal   @db.Decimal(15, 2)
  paymentMethod     String?   // CASH | CREDIT_CARD | DEBIT_CARD | PIX | BANK_TRANSFER | OTHER
  paidAt            DateTime  @default(now())
  receiptUrl        String?
  notes             String?   @db.Text
  createdByUserId   String?   @db.Char(36)
  createdAt         DateTime  @default(now())
  receivable        CustomerReceivable @relation(fields: [receivableId], references: [id])
  company           Company   @relation(fields: [companyId], references: [id])
}

model Expense {
  id            String   @id @default(uuid()) @db.Char(36)
  companyId     String   @db.Char(36)
  serviceOrderId String? @db.Char(36)
  productionOrderId String? @db.Char(36)
  description   String
  amount        Decimal  @db.Decimal(15, 2)
  category      String?  // MATERIAL | LABOR | TRANSPORT | TOOL | GENERAL
  paidAt        DateTime?
  paymentMethod String?
  receiptUrl    String?
  notes         String?  @db.Text
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  company       Company  @relation(fields: [companyId], references: [id])
}
```

### Subfase 8B: Módulo de Recebíveis

**Endpoints:**
```
GET    /receivables — Listar (filtros: status, cliente, período)
POST   /receivables — Criar
GET    /receivables/:id — Obter (com pagamentos)
PATCH  /receivables/:id — Atualizar
POST   /receivables/:id/payments — Registrar pagamento
POST   /receivables/:id/payments/:paymentId/reverse — Estornar
```

### Subfase 8C: Módulo de Despesas

**Endpoints:**
```
GET    /expenses — Listar (filtros: categoria, período, serviço)
POST   /expenses — Criar
GET    /expenses/:id — Obter
PATCH  /expenses/:id — Atualizar
DELETE /expenses/:id — Remover
```

---

## Fase 9 — Estoque e Relatórios

> **Status:** 🔴 A FAZER — 3 subfases | 2 agents | ~15 arquivos

### Subfase 9A: Modelos de dados

```prisma
model InventoryItem {
  id          String   @id @default(uuid()) @db.Char(36)
  companyId   String   @db.Char(36)
  productId   String?  @db.Char(36)
  name        String
  category    String   // RAW_MATERIAL | FINISHED | CONSUMABLE | TOOL
  unit        String   // UN | M2 | KG | L | PC | BAG
  quantity    Decimal  @db.Decimal(15, 3)
  minQuantity Decimal? @db.Decimal(15, 3)
  unitCost    Decimal? @db.Decimal(15, 2)
  location    String?  // storage area / shelf
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  company     Company  @relation(fields: [companyId], references: [id])
  movements   InventoryMovement[]
}

model InventoryMovement {
  id              String    @id @default(uuid()) @db.Char(36)
  itemId          String    @db.Char(36)
  companyId       String    @db.Char(36)
  type            String    // IN | OUT | RESERVATION | CONSUMPTION | ADJUSTMENT | LOSS | RETURN
  quantity        Decimal   @db.Decimal(15, 3)
  unitCost        Decimal?  @db.Decimal(15, 2)
  referenceType   String?   // PURCHASE | PRODUCTION | SERVICE | TRANSFER
  referenceId     String?   // ID da ordem de produção, serviço, etc.
  notes           String?   @db.Text
  createdAt       DateTime  @default(now())
  item            InventoryItem @relation(fields: [itemId], references: [id])
  company         Company  @relation(fields: [companyId], references: [id])
}
```

### Subfase 9B: Módulo de Estoque

**Endpoints:**
```
GET    /inventory — Listar (filtros: categoria, estoque baixo)
POST   /inventory — Criar item
GET    /inventory/:id — Obter (com movimentos)
PATCH  /inventory/:id — Atualizar
POST   /inventory/:id/movements — Registrar movimento
GET    /inventory/:id/movements — Listar movimentos
```

### Subfase 9C: Módulo de Relatórios

**Arquivos:**
- `src/modules/reports/reports.service.ts`
- `src/modules/reports/reports.controller.ts`

**Endpoints:**
```
GET    /reports/service-result/:serviceOrderId — Resultado do serviço
GET    /reports/dashboard — Indicadores do dashboard
GET    /reports/profit-loss — Lucro/perdido por período
GET    /reports/receivables — Relatório de recebíveis
GET    /reports/expenses — Relatório de despesas
GET    /reports/inventory — Relatório de estoque
```

**Cálculos do relatório:**

```
Resultado do serviço:
  Valor vendido (total do orçamento)
  - custo dos materiais (previstos ou reais)
  - mão de obra
  - transporte
  - despesas vinculadas
  = Resultado estimado / real
  Margem % = (resultado / valor vendido) × 100
```

---

## Fase 10 — Deploy, Documentação e Validação Final

> **Status:** 🔴 A FAZER — 4 subfases | 2 agents | ~15 arquivos

### Subfase 10A: Documentação real

**Arquivos:**
- `docs/ARCHITECTURE.md` ← reescrever
- `docs/DATABASE.md` ← reescrever
- `docs/SECURITY.md` ← reescrever
- `docs/MULTITENANCY.md` ← reescrever
- `docs/SUBSCRIPTIONS.md` ← reescrever
- `docs/TESTING.md` ← criar
- `docs/API.md` ← reescrever (ou auto-gerar do Swagger)
- `docs/BACKUP_AND_RECOVERY.md` ← criar
- `README.md` ← atualizar
- `AGENTS.md` ← atualizar

**Cada documento deve conter conteúdo real, não placeholder.**
Exemplo do que cada doc deve ter:

| Documento | Conteúdo mínimo |
|-----------|-----------------|
| ARCHITECTURE.md | Contextos (plataforma vs empresa), camadas, módulos, fluxos de autenticação, diagrama de dependências |
| DATABASE.md | Todos os modelos, relacionamentos, índices, convenções (UUID, Decimal, UTC), migrações |
| SECURITY.md | Threat model, guards, CORS, rate limit, Argon2id, refresh rotation, logs, OWASP |
| MULTITENANCY.md | Isolamento por companyId, guards, consultas, testes A/B, punições |
| TESTING.md | Estratégia, banco de teste, factories, como rodar, cobertura esperada |
| API.md | Endpoints com exemplos de request/response (ou apontar para Swagger) |
| BACKUP_AND_RECOVERY.md | Backup Hostinger, export manual, restore, frequência, plano de incidente |
| SUBSCRIPTIONS.md | Fluxo completo: contrato → mensalidades → pagamentos → vencimento → tolerância → suspensão |

### Subfase 10B: Scripts de operação

**Arquivos:**
- `scripts/check-environment.ts` ← criar
- `scripts/verify-database.ts` ← criar
- `scripts/export-openapi.ts` ← criar
- `scripts/process-subscriptions.ts` ← criar
- `src/modules/subscriptions/subscriptions.cron.ts` ← criar (opcional)

**`process-subscriptions.ts` — Script idempotente de processamento:**
1. Marcar mensalidades vencidas como `OVERDUE`
2. Calcular saldo
3. Alterar contrato para `PAST_DUE` se necessário
4. Aplicar tolerância (grace period)
5. Alterar para `GRACE_PERIOD`
6. Suspender no fim da tolerância
7. Expirar quando aplicável
8. Registrar histórico e auditoria

### Subfase 10C: Configuração de produção

**Arquivos:**
- `.env.example` ← atualizar com todas as variáveis documentadas
- `docs/DEPLOY_HOSTINGER.md` ← reescrever com passo a passo real

**Hostinger:**
1. Fazer upload via FTP/Git
2. `npm ci --production`
3. `npx prisma generate`
4. `npx prisma migrate deploy`
5. `npm run build`
6. Configurar entry point: `dist/main.js`
7. Configurar porta, domínio, HTTPS
8. (Opcional) PM2 para gerenciamento de processo

### Subfase 10D: Validação final definitiva

```
npm run env:check
npm run db:generate
npm run lint               — 0 warnings
npm run typecheck          — 0 errors
npm run test               — todos passando
npm run test:e2e           — todos passando
npm run build              — sucesso
npm run db:status          — migrations aplicadas
npm run db:seed            — idempotente
npm run db:verify          — conexão OK
```

---

## Resumo de Agentes por Fase

| Fase | Nome | Agents | Paralelo | Arquivos |
|------|------|--------|----------|----------|
| F0 | Fundação ✅ | — | — | ~20 |
| F1 | Plataforma + Auth ⚠️ (80%) | — | — | ~30 |
| **F2** | **Modularização + Persistência** | **5** | ✅ 3+2 | **~25** |
| **F3** | **Clientes, Catálogo e Obras** | **2** | ✅ 2 | **~20** |
| **F4** | **Medições e Ambientes** | **1** | — | **~12** |
| **F5** | **Cálculo Automático** | **2** | ✅ 2 | **~15** |
| **F6** | **Orçamentos e PDF** | **2** | ✅ 2 | **~20** |
| **F7** | **Produção e Serviços** | **2** | ✅ 2 | **~15** |
| **F8** | **Financeiro da Empresa** | **2** | ✅ 2 | **~15** |
| **F9** | **Estoque e Relatórios** | **2** | ✅ 2 | **~15** |
| **F10** | **Deploy, Docs, Validação** | **2** | ✅ 2 | **~15** |
| **TOTAL** | | **22 agents** | lotes de 3 | **~180+ arquivos** |

### Distribuição dos 22 agents:

| Lote | Fases | Agents | Descrição |
|------|-------|--------|-----------|
| **Lote 1** | F2 (A+B+C) | 3 | 🔴 Auth, Guards, Convites (crítico) |
| **Lote 2** | F2 (D+E) + F3 | 3 | Modularização + DTOs + Clientes |
| **Lote 3** | F4 + F5 | 3 | Medições + Cálculo de Materiais |
| **Lote 4** | F2 (F+G+H) + F6 | 3 | Auditoria + Seed + Testes + Orçamentos |
| **Lote 5** | F7 + F8 | 4 | Produção + Serviços + Financeiro |
| **Lote 6** | F9 + F10 | 3 | Estoque + Relatórios + Deploy + Docs |
| **Validação** | Todas | 3 | Revisão segurança + qualidade + integração final |

---

## Definição de Done

A API completa está concluída **somente quando** todos os itens abaixo passarem:

- [ ] `npm run lint` — 0 warnings
- [ ] `npm run typecheck` — 0 erros
- [ ] `npm run test` — 100% passando
- [ ] `npm run test:e2e` — 100% passando (incluindo Empresa A vs B)
- [ ] `npm run build` — sucesso
- [ ] MySQL conecta por `DATABASE_URL`
- [ ] Migrations aplicadas em dev
- [ ] Deploy de migration documentado
- [ ] Seed funciona (idempotente)
- [ ] Plataforma autentica (admin)
- [ ] Empresa é cadastrada com endereço + branding
- [ ] Plano é criado
- [ ] Contrato é criado com mensalidades
- [ ] Pagamento total e parcial de mensalidade
- [ ] Suspensão e reativação de empresa
- [ ] Renovação de contrato
- [ ] Convite de proprietário funciona
- [ ] Proprietário aceita convite e autentica
- [ ] Seleção/troca de empresa funciona
- [ ] Branding é retornado no profile
- [ ] Ativo libera acesso, suspenso bloqueia
- [ ] Dados permanecem após suspensão
- [ ] Refresh token com rotação e detecção de reuso
- [ ] Auditoria registra operações críticas
- [ ] Healthcheck funciona
- [ ] Swagger/OpenAPI disponível
- [ ] OpenAPI exportado
- [ ] Todos os stubs de docs substituídos por conteúdo real
- [ ] Nenhum segredo versionado
- [ ] Nenhum teste usou produção
- [ ] Revisão de segurança realizada
- [ ] Revisão de arquitetura realizada
- [ ] Pendências declaradas

---

> **Próximo passo:** Após sua aprovação deste relatório, inicio pela **Fase 2 — Modularização + Persistência Real**, começando pela migração do AuthService e Guards para Prisma (Lote 1 — 3 agents paralelos).
