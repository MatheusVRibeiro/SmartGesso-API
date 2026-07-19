# SmartGesso — Finalização da Fase 2 (Modularização + DTOs + E2E + Docs)

> **Para Hermes:** Usar delegate_task para implementar cada lote. Máx 3 agents paralelos por lote.
> Review + validação pela sessão após cada lote.

**Goal:** Finalizar todas as pendências da FASE-02 que não foram concluídas na implementação anterior (Auth+Guards+Convites migrados para Prisma).

**Contexto atual:**
- ✅ AuthService migrado para Prisma (src/modules/auth/)
- ✅ 5 Guards migrados para Prisma (src/modules/core/guards/)
- ✅ Convite com tokenHash real (argon2)
- ✅ 3 testes unitários passando
- ❌ controllers.ts ainda monolítico (221 linhas, 7 controllers)
- ❌ DTOs ausentes (@Body() b: any em todos os endpoints)
- ❌ src/auth.service.ts e src/security.ts antigos ainda existem
- ❌ Teste E2E (smartgesso.e2e-spec.ts) falhando
- ❌ Documentação ainda stubs de 8 linhas
- ❌ Mobile e Web não existem

---

## Lote 1: Modularização + DTOs (2 agents paralelos)

### Task 1A: Quebrar controllers.ts em módulos individuais

**Objetivo:** Mover cada controller de `src/controllers.ts` para seu respectivo módulo em `src/modules/*/`.

**Arquivos afetados:**
- Criar: `src/modules/health/health.controller.ts`
- Criar: `src/modules/platform-auth/platform-auth.controller.ts`
- Criar: `src/modules/platform-companies/platform-companies.controller.ts`
- Criar: `src/modules/plans/plans.controller.ts`
- Criar: `src/modules/subscriptions/subscriptions.controller.ts`
- Criar: `src/modules/auth/auth.controller.ts`
- Criar: `src/modules/companies/companies.controller.ts`
- Modificar: cada `*.module.ts` correspondente (registrar controller + imports)
- Remover: `src/controllers.ts`
- Modificar: `src/app.module.ts` (importar módulos, remover controllers.ts)

**Sub-tarefas:**
1. Copiar cada classe de controller do `controllers.ts` para seu módulo
2. Atualizar cada module.ts para registrar o controller
3. Atualizar app.module.ts
4. Rodar `npm run typecheck` e `npm run lint`

### Task 1B: Criar DTOs para todos os endpoints

**Objetivo:** Substituir `@Body() b: any` por DTOs tipados com class-validator.

**Arquivos a criar (~15 DTOs):**
- `src/modules/platform-auth/dto/platform-login.dto.ts`
- `src/modules/platform-auth/dto/platform-refresh.dto.ts`
- `src/modules/platform-companies/dto/create-company.dto.ts`
- `src/modules/platform-companies/dto/update-company.dto.ts`
- `src/modules/plans/dto/create-plan.dto.ts`
- `src/modules/plans/dto/update-plan.dto.ts`
- `src/modules/subscriptions/dto/create-subscription.dto.ts`
- `src/modules/subscriptions/dto/generate-installments.dto.ts`
- `src/modules/subscriptions/dto/create-payment.dto.ts`
- `src/modules/auth/dto/user-login.dto.ts`
- `src/modules/auth/dto/accept-invitation.dto.ts`
- `src/modules/auth/dto/switch-company.dto.ts`
- `src/modules/companies/dto/update-branding.dto.ts`
- `src/modules/companies/dto/update-company-profile.dto.ts`

**Sub-tarefas:**
1. Criar cada DTO com class-validator (IsString, IsEmail, IsOptional, IsEnum, Min, IsDecimal)
2. Atualizar controllers para usar os DTOs (`@Body() dto: CreateCompanyDto`)
3. Configurar ValidationPipe com whitelist:true e forbidNonWhitelisted:true (já existe em main.ts)
4. Rodar `npm run typecheck` e `npm run lint`

---

## Lote 2: Limpeza + E2E + Documentação (2 agents paralelos)

### Task 2A: Remover código legado + corrigir teste E2E

**Objetivo:** Remover arquivos antigos (auth.service.ts, security.ts) e fazer o teste E2E passar.

**Arquivos afetados:**
- Remover: `src/auth.service.ts` (após verificar que nenhum import depende dele)
- Remover: `src/security.ts` (após verificar que controllers.ts já importa os novos guards)
- Remover: `src/database/memory.store.ts` (se não usado)
- Remover: `src/domain.ts` (se interfaces não forem mais usadas)
- Modificar: `test/e2e/smartgesso.e2e-spec.ts` — ajustar para:
  - Usar códigos de plano únicos com UUID
  - Remover dependência de rota de suspend (se não existir no controller)
  - Ou implementar rota de suspend no controller se for simples
- Verificar: `src/app.module.ts` — remover imports de arquivos legados

**Sub-tarefas:**
1. Verificar com grep se auth.service.ts, security.ts, memory.store.ts, domain.ts são importados
2. Remover os que não são mais usados
3. Corrigir teste E2E para usar dados únicos e rotas que existem
4. Rodar `npm run test` e `npm run test:e2e`
5. Rodar `npm run typecheck` e `npm run lint`

### Task 2B: Preencher documentação

**Objetivo:** Substituir stubs de 8 linhas por documentação real.

**Arquivos afetados:**
- Modificar: `docs/SECURITY.md`
- Modificar: `docs/API.md`
- Modificar: `docs/DATABASE.md`
- Modificar: `docs/MULTITENANCY.md`
- Modificar: `docs/SUBSCRIPTIONS.md`
- Modificar: `docs/ARCHITECTURE.md`

**Sub-tarefas:**
1. SECURITY.md — threat model, CORS, rate limit, secrets, incidentes
2. API.md — lista de endpoints com métodos e descrição
3. DATABASE.md — modelo de dados, índices, relacionamentos
4. MULTITENANCY.md — guards, consultas, isolamento
5. SUBSCRIPTIONS.md — fluxo de contratos, mensalidades, tolerância
6. ARCHITECTURE.md — contexto, camadas, módulos, fluxos

---

## Lote 3 (opcional, pós-review): Validação final

- Rodar `npm run test` (3 testes unitários)
- Rodar `npm run test:e2e` (2 testes E2E)
- Rodar `npm run typecheck`
- Rodar `npm run lint`
- Rodar `npm run build`
- Commit com mensagem: `feat(core): FASE-02DEF — Modularização, DTOs, E2E, docs`

---

## Definição de Done

- [ ] controllers.ts removido — controllers em módulos individuais
- [ ] Todos os endpoints usam DTOs com class-validator
- [ ] src/auth.service.ts e src/security.ts antigos removidos
- [ ] Testes unitários: 3/3 passando
- [ ] Testes E2E: 2/2 passando
- [ ] typecheck sem erros
- [ ] lint sem erros
- [ ] build sem erros
- [ ] Documentação mínima preenchida (SECURITY, API, DATABASE, MULTITENANCY, SUBSCRIPTIONS, ARCHITECTURE)
- [ ] Commit feito
