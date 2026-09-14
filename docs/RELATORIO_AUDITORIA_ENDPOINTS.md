# RELATÓRIO — Auditoria de Endpoints (Deep Link + Badge Push)

- **Data**: 2026-08-25
- **Repo**: SmartGesso-API · Branch `docs-smartgesso-refactor-2026-08-24`
- **Escopo**: auditoria read-only — endpoints de deep link de orçamento, badge de notificações, eventos de push, cron e rate limit.
- **Estado verificado**: `npx tsc --noEmit` → 0 erros (working tree atual).

> ⚠️ **Nota de contexto**: durante a auditoria, a working tree continha mudanças de outra task em paralelo (endpoints `by-token` e `unread-count` + dashboard-overview). No decorrer da auditoria, a task em paralelo **commitou** os dois endpoints (commit `227c437` — `feat(endpoints): GET /quotes/by-token/:token (deep link) + GET /notifications/unread-count (badge)`). Este relatório documenta o estado REAL do código no momento da auditoria.

---

## 1. ✅ Endpoints existentes

### 1.1 Deep link de orçamento (mobile + web)

| Endpoint | Status | Detalhes |
|---|---|---|
| `GET /quotes/by-token/:token` | ✅ **EXISTE** (commitado em `227c437`) | `src/modules/quotes/quotes.controller.ts:49` — **autenticado** (`JwtAuthGuard` + `ActiveCompanyGuard` + `CompanyAccessGuard`), tenant-scoped via `QuotesService.findByCompanyToken(companyId, token)`. Retorna quote + client + items; 404 se não encontrado no tenant, 410 se link expirado. É o endpoint que o **mobile** precisa para resolver o deep link com o usuário logado. |
| `GET /public/quotes/:token` | ✅ EXISTE (commitado, Fase 2) | `src/modules/quotes/quotes-public.controller.ts` — **sem auth** (deep link web), payload público sem dados sensíveis. |
| `POST /public/quotes/:token/approve` | ✅ EXISTE | Aprovação pública via deep link. |
| `POST /public/quotes/:token/reject` | ✅ EXISTE | Rejeição pública com nota obrigatória (trimada). |
| `POST /quotes/:id/share` | ✅ EXISTE | Gera `publicToken` (32 bytes hex) + `sharedAt` (migration 0018). |

### 1.2 Notificações (badge mobile)

| Endpoint | Status | Detalhes |
|---|---|---|
| `GET /notifications/unread-count` | ✅ **EXISTE** (commitado em `227c437`) | `src/modules/notifications/notifications.controller.ts:39` → `NotificationsService.unreadCount(companyId)`. Retorna `{ count }` de `Notification` com `read: false` da empresa ativa. Rotas sem conflito: declarado antes de `GET /notifications` e não colide com `PATCH :id/read`. |
| `GET /notifications` | ✅ EXISTE | Lista (limit ≤ 200). |
| `PATCH /notifications/:id/read` | ✅ EXISTE | Marca como lida. |
| `POST /notifications/tokens` | ✅ EXISTE | Registro de token push (upsert `PushToken`). |

### 1.3 Cron de follow-ups

| Item | Status | Detalhes |
|---|---|---|
| Cron follow-ups diário | ✅ EXISTE | `NotificationsCronService` (`src/modules/notifications/notifications-cron.service.ts`) — `@Cron(CronExpression.EVERY_DAY_AT_8AM)` → para cada empresa com `QuoteFollowUp` PENDING e `scheduledAt <= fim do dia`: cria `Notification` (type `FOLLOW_UP_TODAY`) + `pushService.sendToCompany` (route `/orcamentos`). Registrado em `NotificationsModule.providers`; `ScheduleModule.forRoot()` ativo em `app.module.ts`. Falhas por empresa são logadas com `warn` (não derruba o cron). |

### 1.4 Rate limit em endpoints públicos

| Item | Status | Detalhes |
|---|---|---|
| `@Throttle` em `QuotesPublicController` | ✅ EXISTE | **Todas as 3 rotas** (`GET :token`, `POST :token/approve`, `POST :token/reject`) com `@Throttle({ default: { limit: 5, ttl: 60_000 } })` — 5 req/min. |
| Throttler global | ✅ EXISTE | `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])` + `APP_GUARD: ThrottlerGuard` em `app.module.ts` (100 req/min como fallback para o resto da API). |
| ⚠️ Observação | — | Limites do throttler v6 são por **rota + IP** (não por token): 5 req/min é compartilhado por todos os tokens da mesma IP. Aceitável para força bruta em token; documentar se houver uso legítimo de alta frequência. |

---

## 2. ❌ Lacunas encontradas

### 2.1 Eventos de push — `PushService.sendToCompany`

| Evento | Status | Onde deveria disparar |
|---|---|---|
| Orçamento aprovado (interno) | ✅ | `QuotesService.approve` (line 515) — "Orçamento aprovado" → route `/servicos/:id` |
| Orçamento rejeitado | ✅ | `QuotesService.reject` (line 582) — "Orçamento rejeitado" → route `/orcamentos/:id` |
| Aprovação via deep link | ✅ | `QuotesService.approvePublicByToken` (line 742) — "Cliente aprovou pelo link" → route `/servicos/:id` |
| Follow-ups do dia (cron) | ✅ | `NotificationsCronService.notifyPendingFollowUps` (line 63) |
| **Pagamento recebido** | ❌ **FALTANDO** | `PaymentsService.payInstallment` (`src/modules/payments/payments.service.ts:147`) confirma parcela/pagamento (`CONFIRMADO`) **sem** criar `Notification` nem push. Idem `ServiceReceivablesService.updateInstallment` (transição para `RECEIVED`, line ~138) — sem notificação. |
| **Despesa registrada** | ❌ **FALTANDO** | `ExpensesService.create` (`src/modules/expenses/expenses.service.ts:15`) — zero referências a `notificationsService`/`pushService` no módulo. |
| **Aditivo aprovado** | ❌ **FALTANDO** | `ServiceAdditionalsService.updateStatus` (`src/modules/service-additionals/service-additionals.service.ts:140`) — transição para `APPROVED` (que altera o financial summary) **sem** notificação/push. |

### 2.2 Cobertura de testes dos endpoints novos

| Endpoint | Testes |
|---|---|
| `GET /quotes/by-token/:token` | ❌ Nenhum spec referencia `by-token`/`findByCompanyToken` |
| `GET /notifications/unread-count` | ❌ Nenhum spec referencia `unread-count`/`unreadCount` |

### 2.3 Estado de commit

| Item | Estado |
|---|---|
| `by-token` (controller + service) | ✅ Commitado em `227c437` (task em paralelo, durante a auditoria) |
| `unread-count` (controller + service) | ✅ Commitado em `227c437` (task em paralelo, durante a auditoria) |

---

## 3. Ações recomendadas (priorizadas)

| # | Prioridade | Ação | Responsável sugerido |
|---|---|---|---|
| 1 | **P0** | ~~Commitar as mudanças pendentes~~ — **RESOLVIDO durante a auditoria**: commitado em `227c437` (task em paralelo). Restante: garantir que os testes (item 2) entrem em commit imediato. | Backend |
| 2 | **P1** | Adicionar testes e2e: `GET /quotes/by-token/:token` (200 no tenant, 404 em outro tenant, 410 expirado, 401 sem auth) e `GET /notifications/unread-count` (count correto, isolação por empresa). | Backend |
| 3 | **P1** | Push em **pagamento recebido**: em `PaymentsService.payInstallment`, quando o pagamento inteiro virar `CONFIRMADO` → `notificationsService.create` (type `PAYMENT_RECEIVED`) + `pushService.sendToCompany` ("Pagamento recebido — #N"). Considerar também `ServiceReceivablesService.updateInstallment` na transição `RECEIVED` (evitar duplo disparo: escolher UM ponto canônico — sugerido `payInstallment`, que é o fluxo mobile). | Backend (módulo payments) |
| 4 | **P2** | Push em **despesa**: `ExpensesService.create` → `notificationsService.create` (type `EXPENSE_CREATED`) + push "Nova despesa: R$ X (categoria)". Injetar `NotificationsService`/`PushService` no `ExpensesModule` (imports de `NotificationsModule`, que já exporta os dois). | Backend (módulo expenses) |
| 5 | **P2** | Push em **aditivo aprovado**: `ServiceAdditionalsService.updateStatus` quando `status === 'APPROVED'` → notificação + push "Aditivo aprovado — R$ X (OS #N)". Injetar deps no `ServiceAdditionalsModule`. | Backend (módulo service-additionals) |
| 6 | **P3** | Documentar no `docs/API.md` os 2 novos endpoints (`by-token`, `unread-count`) + o comportamento do rate limit por rota+IP nos públicos. | Backend |

### Padrão para os itens 3–5 (mesmo dos eventos existentes)

```
try {
  await this.notificationsService.create(companyId, { type, title, body, data });
  await this.pushService.sendToCompany(companyId, { title, body, data: { route } });
} catch (error) {
  this.logger.warn(`Falha ao notificar <evento>: ${error.message}`);
}
```
Notificação/push **nunca** pode quebrar a operação principal (padrão já usado em `approve`/`reject`/`approvePublicByToken`).

---

## 4. Verificação rápida (comandos usados)

```bash
grep -rn "by-token\|byToken" src/ --include="*.ts"          # → quotes.controller.ts:49
grep -rn "unread-count\|unreadCount" src/ --include="*.ts"  # → notifications controller+service
grep -rn "sendToCompany" src/ --include="*.ts"              # → 4 call sites (quotes×3, cron×1)
grep -rn "Cron" src/modules/notifications/                  # → NotificationsCronService @Cron 08:00
grep -rn "Throttle" src/modules/quotes/quotes-public.controller.ts  # → 3 rotas, 5 req/min
npx tsc --noEmit                                            # → 0 erros
```
