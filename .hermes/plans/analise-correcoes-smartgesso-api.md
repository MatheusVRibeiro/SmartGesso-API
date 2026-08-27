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
