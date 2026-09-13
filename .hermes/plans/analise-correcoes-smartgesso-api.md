# Plano: Análise Completa + Correções — SmartGesso API

> Branch: `docs-smartgesso-refactor-2026-08-24` (já ativa)
> Data: 2026-08-27

## Objetivo
Analisar a API SmartGesso (segurança, qualidade, schema/DB) e corrigir os achados priorizados.

## Fase 1 — Análise (em andamento)
- [x] Inventário inicial (15.5k linhas TS, 50 models, 35 enums, 25 arquivos de teste)
- [x] Baseline: `npm run typecheck` → EXIT=0
- [x] Leitura de arquivos críticos (main.ts, app.module.ts, guards, filters, safe-logo-url)
- [ ] 4 subagents de análise (segurança auth/IDOR, segurança superfície, qualidade, schema/DB)
- [ ] Sintetizar relatório consolidado 🔴🟠🟡🔵

## Fase 2 — Correções (após relatório)
- [ ] Lote 1: correções 🔴 (4 subagents)
- [ ] Lote 2: correções 🟠 (4 subagents)
- [ ] Lote 3: correções 🟡 (4 subagents)
- [ ] Validação final: typecheck + lint + tests + build
- [ ] Commit PT-BR

## Baseline (2026-08-27)
- `npm run typecheck` → EXIT=0 (limpo)
- `npm test` → 401 passed / 23 suites (EXIT=0)
- `npm run lint` → EXIT=1, 23 erros pré-existentes (unused imports, no-useless-catch, @ts-nocheck, prefer-const) — candidatos a correção trivial

## Progresso Lint (23 → 0 erros)
- [x] `paginate.ts` — removido import PrismaService não usado + `Function` → tipagem `FindManyCount`
- [x] `payments.service.ts` — removido `CreatePaymentInstallmentDto` + try/catch useless
- [x] `service-orders.service.ts` — try/catch useless removido
- [x] `logging.interceptor.ts` — `responseBody` → `_responseBody`
- [x] `update-production-order.dto.ts` — import morto removido
- [x] `quote-environments.service.ts` — import `Prisma` morto removido
- [x] `quotes.controller.ts` — `StreamableFile` + `error` não usados
- [x] `create-receivable.dto.ts` / `update-installment.dto.ts` / `create-service-return.dto.ts` / `create-service-warranty.dto.ts` — imports mortos removidos
- [x] `attachments.spec.ts` — imports fs não usados removidos
- [x] `company-sequence-concurrency.spec.ts` — `createSimpleMock` morto removido
- [x] `quotes-public-deep-links.spec.ts` — `let tx` → `const tx`
- [x] `quotes-pdf.service.ts` — **`@ts-nocheck` ELIMINADO** (12 erros PDFDocument → `typeof`, `require()` → `import * as`, `openImage` tipado via interface) — código de segurança agora type-checked
- [ ] Validar: typecheck ✅ lint ✅ | testes | build

## Achados dos subagents (4 relatórios consolidados 2026-08-27)

### 🔴 CRÍTICO (confirmados)
| # | Achado | Origem | Status |
|---|--------|--------|--------|
| C1 | **IDOR cross-tenant service-receivables**: `req.user.companyId` sempre undefined (User não tem companyId) → queries sem filtro tenant | T1+T4 | 🔧 corrigir |
| C2 | **Escalação privilégio company-members**: sem PermissionsGuard, qualquer membro vira COMPANY_OWNER / remove colegas | T1 | 🔧 corrigir |
| C3 | **SSRF logoUrl 3 bypasses**: redirect não revalidado, DNS rebinding, IPv4-mapped IPv6 | T2 | 🔧 corrigir |
| C4 | **Path traversal uploads**: entityId não sanitizado → escrita arbitrária; sendFile sem root | T2 | 🔧 corrigir |

### 🟠 ALTO
| # | Achado | Origem |
|---|--------|--------|
| A1 | PermissionsGuard no-op em companies (profile/branding) + `status` editável por membro | T1 |
| A2 | Matriz de permissões aplicada em só 2 de ~40 rotas | T1 |
| A3 | Login plataforma sem throttle (brute force) | T1+T2 |
| A4 | Logout plataforma sem guard → sessão nunca revogada | T1 |
| A5 | Tokens push de ex-membros nunca revogados | T2 |
| A6 | quotes.service.ts 1003 linhas (God file) + race createVersion + notificação dupla | T3 |
| A7 | convertDecimals duplicado 5× + ensure* duplicado 5× | T3 |
| A8 | business.service.ts 13 dto:any + status sem validação | T3 |

### 🟡 MÉDIO (amostra)
- M1: acceptInvitation varre TODOS convites (DoS CPU) — fix tokenRef
- M2: rotateSession loop argon2 sem limite + sem purga
- M3: switchCompany altera activeCompanyId de TODAS as sessões
- M4: CORS `*` em produção deve falhar (fail-closed)
- M5: SWAGGER_ENABLED=true no .env.example
- M6: TRUST_PROXY nunca lido
- M7: FKs sem índice (CompanyAddress, Payment.quoteId, billing models)
- M8: Client.status / ProductionOrderItem.status String → enum
- M9: PrismaRepositoryService + memory.store.ts + domain.ts mortos

## Fase 2 — Correções (em andamento)
- [x] Lote 0 (lint): 23 erros → 0 + @ts-nocheck eliminado (commit b2f9375)
- [x] Lote 1: críticos C1-C4 — **commit 023129b** (IDOR, escalação, SSRF, path traversal) + altos A1/A3/A4/A5 + médios M3/M4/M5/M6/M12 + código morto
- [ ] Lote 2: A2 (matriz permissões em ~40 rotas), A6 (quotes.service god file), A7 (convertDecimals), A8 (business DTOs)
- [ ] Lote 3: M1/M2 (tokenRef), M7 (índices schema), M8 (enums status)
- [ ] Validação final: typecheck + lint + tests + build
- [ ] Commit PT-BR

## Achados preliminares (análise própria)
| # | Achado | Severidade | Status |
|---|--------|-----------|--------|
| P1 | `quotes.service.ts` 1003 linhas (God file) | 🟠 | pendente |
| P2 | `dashboard-overview.service.ts` 720 linhas | 🟡 | pendente |
| P3 | `quotes-pdf.service.ts` 634 linhas + `@ts-nocheck` (código de segurança fora do typecheck) | 🟠 | pendente |
| P4 | `business.service.ts` (plataforma) usa `dto: any` — sem DTOs tipados | 🟡 | pendente |
| P5 | 233 ocorrências de `: any` / `as any` | 🟡 | pendente |
| P6 | Models sub-entidade sem companyId direto (QuoteEnvironment, QuoteFollowUp, Work) — verificar scoping via pai | 🟡 | pendente |
| P7 | `@Throttle` login 5/min OK; Throttler global 100/min | ✅ | ok |
| P8 | RequirePermissions aplicado em 2 controllers (company-features, goals) | ✅ | ok |
| P9 | `forgot-password` e `reset-password` são STUBS (`{ ok: true }` sem lógica) | 🟠 | pendente |

## Pontos fortes confirmados (não mexer)
- JwtAuthGuard: decode-before-verify + requireSecret + status ACTIVE
- HttpExceptionFilter: loga stack 5xx, nunca expõe ao cliente
- safe-logo-url.ts: anti-SSRF completo (IPv4/IPv6 + DNS)
- Refresh token: argon2 + detecção de reuso + rotação
- CORS fail-closed + helmet + ValidationPipe whitelist
- console.log: apenas 2 (estruturados, sem dados sensíveis)
