# ROADMAP — SmartGesso API

Documentação completa da API NestJS + Prisma + MySQL.

---

## Visão Geral

API multi-tenant para gestão comercial/operacional/financeira de empresas de gesso e drywall.
Stack: NestJS 11 + Prisma 6 + MySQL 8.4 + TypeScript 5.8.

---

## Fase 1: Plataforma e Autenticação ✅

### Objetivo
Core da plataforma: auth, multi-tenant, empresa, plano, assinatura.

### Módulos
- [x] Auth (login, logout, refresh, convite, aceitar convite)
- [x] Platform Auth (admin global)
- [x] Companies (CRUD + CompanyAccess)
- [x] Plans (CRUD)
- [x] Subscriptions (assinaturas + installment + payment + history)
- [x] Core Guards (JwtAuthGuard, PlatformAdminGuard, ActiveCompanyGuard, CompanyAccessGuard, PermissionsGuard)
- [x] Health check

### Schema
- [x] PlatformAdmin, Company, CompanyAddress, CompanyBranding
- [x] Plan, Subscription, SubscriptionInstallment, SubscriptionPayment, SubscriptionHistory
- [x] User, CompanyMember, UserSession, OwnerInvitation
- [x] AuditLog

### Segurança
- [x] JWT access (15min) + refresh (30d) com rotation + detecção de reuso
- [x] Argon2 para senhas e tokens
- [x] ValidationPipe global (whitelist + forbidNonWhitelisted)
- [x] Helmet headers
- [x] Isolamento multi-tenant (companyId em queries)
- [x] Rate limiting global (ThrottlerGuard) + throttle em login/refresh/accept-invitation
- [x] CORS allowlist (CORS_MOBILE_ORIGINS / CORS_ADMIN_WEB_ORIGINS)
- [x] Secrets fail-closed (requireSecret — sem fallback hardcoded)
- [x] Swagger apenas em dev (NODE_ENV !== production)

---

## Fase 2: Catálogo e Operações ✅

### Objetivo
Catálogo de produtos/serviços, clientes, obras e medições.

### Módulos
- [x] Clients (CRUD clientes)
- [x] Works (CRUD obras)
- [x] Catalog (produtos, serviços, materiais)
- [x] Measurements (ambientes + medições)
- [x] Compositions (composições de materiais)

### Schema
- [x] Client, Work, Product, Service, Material
- [x] Measurement, Composition, CompositionItem

---

## Fase 3: Orçamentos ✅

### Objetivo
Orçamentos com itens, custos, margens, PDF, aprovação → conversão em serviço.

### Módulos
- [x] Quotes (CRUD + versionamento + aprovação/rejeição + duplicar)
- [x] QuotesPdfService (PDF com identidade empresa, prazo, pagamento, garantia)
- [x] Conversão Quote → ServiceOrder (quoteId vinculado)

### Schema
- [x] Quote, QuoteHistory, QuoteItem

### Fluxo
- [x] Criar orçamento → adicionar itens → enviar → aprovar/rejeitar
- [x] Aprovação cria ServiceOrder automaticamente
- [x] PDF com prazo/pagamento/garantia/validade
- [x] Anti-SSRF no logoUrl (bloqueia IPs privados)

---

## Fase 4: Produção e Serviços ✅

### Objetivo
Ordens de produção e serviço com checklist, materiais, agenda.

### Módulos
- [x] ProductionOrders (CRUD + itens)
- [x] ServiceOrders (CRUD + materiais + checklist + status estendido)
- [x] Schedule (agenda de eventos)

### Schema
- [x] ProductionOrder, ProductionOrderItem
- [x] ServiceOrder, ServiceOrderMaterial
- [x] ScheduleEvent

### Status OS estendido
- [x] PENDENTE, EM_PRODUCAO, EM_ANDAMENTO, EM_DESLOCAMENTO, PAUSADA, CONCLUIDA, CANCELADA

---

## Fase 5: Financeiro ✅

### Objetivo
Pagamentos, despesas, dashboard da empresa.

### Módulos
- [x] Payments (pagamentos parcelados + resultado serviço)
- [x] Expenses (despesas)
- [x] CompanyDashboard (métricas da empresa)
- [x] CompanyMembers (membros + permissões)
- [x] Business Service (acesso + branding)

---

## Fase 6: Estoque ✅

### Objetivo
Controle de estoque com movimentações e alertas.

### Módulos
- [x] Inventory (movimentações: RESERVA, CONSUMO, DEVOLUÇÃO)

### Schema
- [x] InventoryMovement (type enum: RESERVA, CONSUMO, DEVOLUÇÃO)

---

## Fase 7: Notificações e Uploads ✅

### Objetivo
Notificações push e upload de fotos.

### Módulos
- [x] Notifications (PushToken + Notification CRUD)
- [x] Uploads (multipart com sanitização + static serving)

### Segurança Uploads
- [x] fileFilter MIME allowlist (jpg/png/webp/gif)
- [x] sanitizeSubdir (path traversal protection)
- [x] Headers nosniff + CSP em /uploads

---

## Fase 8: Dashboard Plataforma ✅

### Objetivo
Métricas globais para admin da plataforma.

### Módulos
- [x] Dashboard (métricas: empresas, assinaturas, receita, vencimento)

---

## Pendências Conhecidas

### 🔴 Críticos
- Nenhum

### 🟠 Altos
1. **forgot-password/reset-password** — stubs (retornam `{ok:true}` sem ação) → implementar ou remover
2. **npm audit** — 7 high (js-yaml via @nestjs/swagger) → `npm audit fix`
3. **Teste E2E flaky** — `app.spec.ts` falha na suíte completa (banco prod) → usar staging

### 🟡 Médios
1. **Código morto** — `memory.store.ts` + `domain.ts` sem uso → remover
2. **@ts-nocheck** — `quotes-pdf.service.ts` (pdfkit CommonJS) → remover quando migrar para lib tipada
3. **Cobertura de testes** — 40 testes, 3 suites → aumentar coverage

### 🔵 Baixos
1. **Swagger docs** — pode ser exposto em staging para devs
2. **Accept-invitation O(n)** — busca todos convites pendentes → otimizar query

---

## Métricas

| Item | Resultado |
|------|-----------|
| Módulos | 25 |
| Modelos Prisma | 30+ |
| Testes | 40 (3 suites) |
| tsc --noEmit | ✅ exit 0 |
| Guard coverage | 23/24 controllers |
| Arquivos >500 linhas | 4 (quotes-pdf, quotes, auth, business) |

---

## Atualizações do Roadmap

| Data | Atualização |
|------|-------------|
| Agosto 2026 | Roadmap completo criado — reflete estado V3 |
