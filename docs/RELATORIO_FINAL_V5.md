# SmartGesso — Relatório Final da Consolidação V5

**Data:** 08/09/2026 · **Branch:** `docs-smartgesso-refactor-2026-08-24` (API e Mobile, sem push) · **Executor:** Hermes (orquestração GPT/Codex + subagents Verboo glm-5.3-flash)

---

# BACKEND (SmartGesso-API)

## Commits (17)
| Commit | Conteúdo |
|---|---|
| `8a7317c` | quote-environments: DTOs dedicados de medição + testes + plano V5 |
| `a6c85b5` | ServiceOrder: pauseReason/etapas/needsProduction — schema, migration `20260907120000`, DTOs, service |
| `db1ef38` | measurements: CompanyAccessGuard + PermissionsGuard por método |
| `9337e3a` | approve idempotente sob concorrência — migration `20260907130000` (dedup legado + UNIQUE companyId,quoteId), catch P2002, teste |
| `114a703` | payments: valida cliente↔OS em create/update + include serviceOrder + 10 testes |
| `ed95e2d` | permissões granulares (RequirePermissions) em clients, quotes, service-orders, payments, expenses, inventory, catalog, compositions |
| `28f5e7a` | testes de rollback transacional (Quote.update / ServiceOrder.update) |
| `b07a5db` | /auth/me expõe role+permissions + códigos de erro padronizados nos guards (FORBIDDEN, COMPANY_ACCESS_DENIED, SUBSCRIPTION_GRACE_PERIOD) |
| `f0155ba` | GET /health/readiness com validação de banco (503 graceful) |
| `59ee7e7` | uploads privados: useStaticAssets removido, rota autenticada por empresa, Attachment por upload (fail-closed p/ legado) |

## Endpoints novos/alterados
- `GET /health/readiness` — valida banco
- `GET /uploads/:subdir/:filename` — autenticado por empresa (substitui estático)
- `POST /uploads` — cria Attachment + retorna attachmentId
- `GET /auth/me` — agora com role + permissions[]

## Migrations (2, não destrutivas)
- `20260907120000_add_serviceorder_operational_fields` — 3 colunas novas
- `20260907130000_enforce_serviceorder_quote_uniqueness` — desvincula OS duplicadas legadas (não apaga) + UNIQUE

## Gates finais (evidência fresca)
- `npm test`: **29 suites / 475 testes ✅** · `npm run build`: EXIT=0 · `npm run lint`: EXIT=0 · `tsc --noEmit`: EXIT=0 · `prisma validate`: OK
- Verificação dos critérios da seção 25: **16/16 ✅** (prova por arquivo:linha no relatório do subagent)

---

# MOBILE (SmartGesso-Mobile)

## Commits (12)
| Commit | Conteúdo |
|---|---|
| `2695b59` | plano V5, pendências, design system (docs) |
| `8edb4b0` | registerResult via PATCH (contrato único) |
| `0539ee9` | pagamento a partir da OS envia serviceOrderId + teste |
| `7ac574f` | ServicoDetalhe consome financial-summary (mata cálculo por clientId) |
| `35f4919` | bloqueio financeiro offline + processor com base URL e Bearer |
| `450df46` | home sem "Nova OS" (Serviço nasce do orçamento) |
| `d6f61f2` | PermissionGate único com permission explícita, SEM fallback COMPANY_OWNER + bootstrap carrega role/permissions |
| `b2e77c8` | menu Mais em 5 seções + feature flags (Produção/Estoque/needsProduction) |
| `d4a8e39` | wizard modularizado em src/features/quotes/create (1676→729 linhas) |
| `29a1777` | AuthImage com download Bearer por plataforma + 12 testes |
| `5659a3c` | testes approve flow (service + tela) + error mapper |
| `cae250e` | dedup toArray — utilitário único + 14 telas migradas |

## Estrutura nova
- `src/features/quotes/create/` — hooks (useQuoteDraft, useQuoteWizard, useMaterialCalculation, useQuoteSubmit), components (QuickClientModal, ClientPickerModal, StepProgress), types, utils
- `src/components/ui/AuthImage.tsx` — imagem com URL protegida
- `src/utils/toArray.ts` — normalizador único de listas

## Gates finais
- `jest`: **56 suites / 379 testes ✅** · `tsc --noEmit`: EXIT=0
- Verificação dos critérios da seção 25: **13/13 ✅**

---

# INTEGRAÇÃO (API ↔ Mobile)

## Contratos convergidos
| Contrato | API | Mobile |
|---|---|---|
| approve → {quote, serviceOrder, serviceOrderCreated} | ✅ idempotente (UNIQUE + P2002) | ✅ navega com serviceOrder.id |
| result da OS | PATCH ✅ | PATCH ✅ |
| pauseReason/etapas/needsProduction | schema+DTOs ✅ | types+PATCH ✅ |
| Expense.serviceOrderId | DTO+validação tenant ✅ | envia ✅ |
| Payment.serviceOrderId | DTO+validação cliente↔OS ✅ | envia ✅ |
| financial-summary por OS | endpoint ✅ | tela consome ✅ |
| permissões | RequirePermissions ×9 controllers ✅ | PermissionGate por permission ✅ |
| role/permissions | /auth/me + /company/permissions ✅ | bootstrap carrega no store ✅ |
| uploads | privado autenticado ✅ | AuthImage Bearer ✅ |
| erro por code | guards com code ✅ | client.ts mapeia ✅ |
| offline | — | financeiro bloqueado + processor autenticado ✅ |

## Critérios globais de aceite (seção 25): 28/28 ✅
Verificados por 2 subagents de validação read-only (16 API + 13 Mobile + complementos com grep próprio do orquestrador — critérios #1, #9, #14, #15, #16, #26, #27).

## Legado mantido (não removido, conforme plano)
- `convert-to-service` (deprecated, delega ao mesmo helper)
- `app/(app)/servicos/novo.tsx` (sem entrada no menu — futuro "Serviço avulso")
- Work/WorkPickerModal (leitura de dados antigos; QuoteEnvironment já é o caminho novo)
- Attachment legado sem registro → 404 (fail-closed), sem apagar arquivos

## Riscos residuais
1. **ESLint Mobile quebrado** (pré-existente): `eslint-plugin-react` antigo × ESLint 10 — crash no carregamento de regra, independente do código. Fix: `npm i -D eslint-plugin-react@latest` (fora do escopo — não autorizado mudar deps).
2. **`prisma generate` com EPERM no OneDrive** — client funciona (typecheck/build/testes provam); usar cópia de verificação fora do OneDrive quando precisar regenerar.
3. **Fotos legadas pré-Attachment** retornam 404 na rota autenticada (fail-closed deliberado). Se houver fotos antigas que precisem continuar visíveis, rodar script de backfill criando Attachment para os arquivos existentes em disco.
4. **E2E nativo (Maestro)** e `npm run api:generate` (OpenAPI real) ficaram como evolução pós-V5, conforme o próprio plano (seções 20/13).

## Recomendações
1. Push das 2 branches + aplicar as 2 migrations no banco Hostinger (via `prisma db push` ou SQL manual — não destrutivas).
2. Backfill de Attachments para uploads legados (script simples sobre o diretório de uploads).
3. Atualizar `eslint-plugin-react` e reativar o gate de lint do Mobile no CI.
4. ~~Testes de role matrix (seção 20/Fluxo 5) como próximo reforço de QA — os guards estão no lugar, faltam specs dedicated por papel.~~ **CONCLUÍDA (2026-09-12).**
5. Security RBAC (2026-09-12): RequirePermissions + PermissionsGuard aplicados nos 14 controllers que tinham escrita sem permissão por role (suppliers, works, production-orders, purchase-orders, service-additionals, service-receivables, service-warranties, quote-follow-ups, quote-environments, schedule) — subscriptions NÃO aplicado: é controller de PLATAFORMA (PlatformAdminGuard, sem req.member/permissions — RequirePermissions causaria 403 em todas as rotas; autorização de platform admin permanece no próprio guard, conforme regra do AGENTS.md de não misturar guards de plataforma com empresa) + suíte Role matrix invariants em company-permissions.test.ts (hierarquia OWNER⊇MANAGER, isolamento SALES/FINANCE/INSTALLER, sem permissões vazias/duplicadas) — gates: build/test/tsc EXIT=0
