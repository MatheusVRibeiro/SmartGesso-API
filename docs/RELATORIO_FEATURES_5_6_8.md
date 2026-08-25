# SmartGesso — Relatório de Implementação: Features #5, #6, #8

> **Data:** 2026-08-24
> **Escopo:** Notificações Push completas (#5), Deep Links de Orçamento (#6), Dashboard de Metas/Performance (#8)
> **Stack:** NestJS + Prisma + MySQL (API) · Expo/React Native (Mobile)

---

## ESTADO ATUAL (baseline verificado)

### Backend — Já existe (base pronta)
| Item | Estado |
|------|--------|
| `Notification` model (companyId, type, title, body, data, read) | ✅ |
| `PushToken` model (companyId+token unique, platform, deletedAt) | ✅ |
| `POST /notifications/tokens` (registerToken upsert) | ✅ |
| `GET /notifications` (lista, limit) | ✅ |
| `PATCH /notifications/:id/read` | ✅ |
| `NotificationsService.create()` (cria notificação no banco) | ✅ |
| Guards completos (Jwt + Active + CompanyAccess) | ✅ |
| Feature flag `pushNotifications` (B13) | ✅ |

### Mobile — Parcial
| Item | Estado |
|------|--------|
| `expo-notifications` ~57.0.12 | ✅ instalado |
| `notificationsApi` service (registerPushToken, list, markRead) | ✅ |
| Tela `notificacoes/` (lista + layout) | ✅ |
| `expo-device` | ❌ verificar |
| Registro de token no login | ❌ falta |
| Handler de notificação recebida | ❌ falta |
| Badge/contador não-lidas | ❌ falta |
| scheme `smartgesso` (app.config.ts) | ✅ (base p/ deep links) |

---

## FEATURE #5 — NOTIFICAÇÕES PUSH COMPLETAS

### Objetivo
Todas as notificações do app funcionando: receber push em tempo real (orçamento aprovado, serviço criado, follow-up, pagamento recebido), badge de não-lidas, abrir notificação → tela correta.

### Etapas

#### Backend (5.1–5.4)
**5.1 — PushService (expo-server-sdk ou HTTP)**
- Instalar `expo-server-sdk` (ou chamada HTTP direta ao FCM/APNs via Expo)
- Criar `src/modules/notifications/push.service.ts`:
  - `sendPush(companyId, { title, body, data })` — busca PushTokens ativos da empresa, envia via Expo
  - Remoção de tokens inválidos (TicketError 422/ExponentDeviceNotRegistered → soft delete)
- Registrar no `NotificationsModule`

**5.2 — Disparo automático por eventos de negócio**
- Orçamento **aprovado** → push "Orçamento #X aprovado — Serviço criado"
- Orçamento **rejeitado** → push "Orçamento rejeitado"
- **Follow-up hoje** (cron) → push "Você tem N follow-ups hoje"
- **Pagamento recebido** → push "Pagamento de R$X confirmado"
- **Despesa registrada** → push (se configurado)
- **Aditivo aprovado** → push "Aditivo aprovado"
- **Serviço concluído** → push
- Integrar chamadas ao PushService nos services existentes (quotes.approve, payments.confirm, etc.)
- Cada evento também cria `Notification` no banco (rastreabilidade)

**5.3 — Cron de follow-ups do dia**
- Reutilizar `ScheduleModule` existente
- Cron diário (ex: 08:00) → busca follow-ups PENDING de hoje → push para a empresa + cria Notification

**5.4 — Testes backend**
- PushService: tokens ativos, token inválido removido, tenant isolation
- Eventos: approve dispara push + cria Notification
- Cron: follow-ups de hoje geram push

#### Mobile (5.5–5.9)
**5.5 — Registro de token push**
- Instalar `expo-device` (se não tiver)
- Após login + seleção de empresa → `Notifications.registerForPushNotificationsAsync()`:
  - Pedir permissão (`expo-notifications`)
  - Obter `ExpoPushToken` (ExpoPushToken)
  - Chamar `notificationsApi.registerPushToken(token)`
- Hook `usePushTokenRegistration` que roda no app mount

**5.6 — Handler de notificação recebida**
- `NotificationHandler` no `_layout.tsx`:
  - `addNotificationResponseReceivedListener` → navegar para a tela do `data` (ex: `data.route = '/orcamentos/xyz'`)
  - Foreground: `addNotificationReceivedListener` → atualizar badge + lista (invalida query)
- Tipagem do `data` (tela, id)

**5.7 — Badge de não-lidas**
- `GET /notifications/unread-count` (novo endpoint backend) OU calcular no client
- Tab bar badge na aba "Notificações"
- Atualizar ao ler/marcar lidas

**5.8 — Pull-to-refresh + empty/error states na tela de notificações**
- Lista já existe — garantir estados completos (loading, erro, vazio)

**5.9 — Testes mobile**
- Service: registerPushToken, list, markRead, unread-count
- Hook de registro (mock expo-notifications + expo-device)
- Handler de response (navegação correta)

---

## FEATURE #6 — DEEP LINKS DE ORÇAMENTO (link para cliente)

### Objetivo
Cliente recebe link do orçamento (WhatsApp/email), abre no navegador/app, vê o orçamento e pode **aprovar/rejeitar** sem instalar app (web) ou via deep link (app).

### Etapas

#### Backend (6.1–6.4)
**6.1 — Token público de orçamento**
- Schema: `QuotePublicToken` (migration nova) ou campo `publicToken String? @unique` no Quote
- Gerar token aleatório criptográfico (32 bytes hex) ao marcar orçamento como `PRONTO_PARA_ENVIAR` ou endpoint explícito `POST /quotes/:id/share`
- **NUNCA** expor companyId/ids internos no link

**6.2 — Endpoints públicos (sem auth)**
- `GET /public/quotes/:token` — dados do orçamento para exibição (client nome, itens, total, validade)
- `POST /public/quotes/:token/approve` — aprovação pública (idempotente — mesma regra do approve interno)
- `POST /public/quotes/:token/reject` — rejeição com motivo
- Rate limit agressivo (evitar brute force de token) + token expira (validUntil ou data)

**6.3 — Auditoria e notificação**
- Aprovação pública → mesma lógica de criar ServiceOrder + push "Cliente aprovou o orçamento!" + Notification
- AuditLog da ação pública (quem/qual dispositivo não sabe → registrar `actorType: 'public'`)

**6.4 — Testes backend**
- Token único por orçamento, 404 p/ token inválido, idempotência, rate limit, push após aprovação

#### Mobile (6.5–6.8)
**6.5 — Publicar link**
- Tela do orçamento → botão "Compartilhar" → chama `POST /quotes/:id/share` → retorna link `https://app.smartgesso.com.br/o/<token>` (ou `smartgesso://o/<token>`)
- Share via `expo-sharing` / `Share.share` (WhatsApp, email, copiar)

**6.6 — Deep link no app**
- `smartgesso://o/<token>` e `https://app.smartgesso.com.br/o/<token>` (universal link futuro)
- Configurar `Linking` no app.config.ts
- Handler: se logado → abrir `orcamentos/[id]` (precisa buscar quote por token → endpoint `GET /quotes/by-token/:token` autenticado) → senão → tela de login + redirect após login

**6.7 — Tela web pública (opcional, admin web ou landing)**
- Página `/o/[token]` que renderiza o orçamento (read-only) + botões Aprovar/Rejeitar
- Se for Next.js admin: adicionar rota pública sem auth

**6.8 — Testes mobile**
- Service share: gera link, retorna token
- Deep link handler: rota correta, sem login → login → redirect

---

## FEATURE #8 — DASHBOARD DE METAS/PERFORMANCE

### Objetivo
Gestor vê performance por vendedor/empresa: metas vs realizado (orçamentos aprovados, receita, follow-ups feitos).

### Etapas

#### Backend (8.1–8.3)
**8.1 — Model de Metas**
- Schema: `CompanyGoal` (migration nova): id, companyId, period (MENSAL), year, month, targetQuoteAmount (Decimal), targetRevenue (Decimal), targetApprovedQuotes (Int), createdById, timestamps
- `@@unique([companyId, year, month])`
- CRUD: GET/POST/PATCH `/goals` (permissão MANAGER/OWNER)

**8.2 — Endpoint de performance**
- `GET /dashboard/performance?year=&month=`:
  - Por membro (vendedor): orçamentos criados, aprovados, taxa de aprovação, follow-ups feitos, receita gerada (soma de ServiceOrders aprovadas no mês)
  - Totais empresa vs metas (CompanyGoal): % realizado por métrica
- Agrupar por `createdById`/`saleValue` — queries agregadas Prisma

**8.3 — Testes backend**
- Metas CRUD + tenant isolation
- Performance: agregações corretas, divisão por vendedor, % vs meta

#### Mobile (8.4–8.7)
**8.4 — Service + types**
- `src/types/goal.ts` (CompanyGoal, PerformanceReport, PerformanceRow)
- `src/services/api/goals.ts` (getGoals, setGoal, getPerformance)

**8.5 — Tela Metas**
- `app/(app)/metas/` (rota nova, feature-gated por `advancedFinance` ou `team`)
- Seleção mês/ano
- Cards: meta vs realizado (orçamentos, receita, aprovação) com barras de progresso
- Lista por vendedor com rank

**8.6 — Integração menu/home**
- Item "Metas" no menu (seção Gestão) com FeatureGate
- Card na home com resumo do mês

**8.7 — Testes mobile**
- Service goals (mock API)
- Componente de progresso (meta vs realizado)

---

## ORDEM DE IMPLEMENTAÇÃO (dependências)

```
FASE 1 — PUSH NOTIFICATIONS (feature #5)
  Backend: 5.1 PushService → 5.2 eventos → 5.3 cron → 5.4 testes
  Mobile:  5.5 registro token → 5.6 handler → 5.7 badge → 5.8 tela → 5.9 testes

FASE 2 — DEEP LINKS (feature #6)  [depende de #5 para notificar cliente]
  Backend: 6.1 token → 6.2 endpoints públicos → 6.3 auditoria → 6.4 testes
  Mobile:  6.5 publicar → 6.6 deep link → 6.7 web (opcional) → 6.8 testes

FASE 3 — METAS/PERFORMANCE (feature #8)  [independe de #5/#6]
  Backend: 8.1 model → 8.2 endpoint → 8.3 testes
  Mobile:  8.4 service → 8.5 tela → 8.6 menu → 8.7 testes
```

## RISCOS
- **expo-notifications em web** não funciona (APK/device necessário) — testar em dev build/Android
- **expo-server-sdk** precisa do token do projeto Expo (config) — usar variável de ambiente `EXPO_ACCESS_TOKEN` (opcional para dev; funciona sem em dev)
- **Deep link web público** pode exigir deploy — entregar primeiro o fluxo in-app + link share
- **Metas** exigem decisão de negócio simples (métricas por vendedor) — usar defaults sensatos

## CRITÉRIO DE CONCLUSÃO
- [ ] Push: orçamento aprovado → notificação chega no device em < 5s + badge atualiza
- [ ] Push: follow-up do dia → notificação na hora agendada
- [ ] Deep link: compartilhar orçamento → link abre app/web → cliente aprova → ServiceOrder criada + push pro gestor
- [ ] Metas: gestor define meta do mês → dashboard mostra % realizado por vendedor
- [ ] Todos os testes backend + mobile verdes
