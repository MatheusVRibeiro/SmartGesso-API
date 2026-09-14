# SmartGesso — Plano de Consolidação V5  
## API + Mobile — Especificação Técnica Coordenada

> **Baseline:** branches `main` públicas de `MatheusVRibeiro/SmartGesso-API` e `MatheusVRibeiro/SmartGesso-Mobile`, analisadas em 07/09/2026.  
>  
> **Objetivo:** consolidar o SmartGesso antes de ampliar novamente o escopo. A V5 prioriza convergência API ↔ Mobile, integridade, financeiro, segurança, UX e infraestrutura.  
>  
> **Importante:** se houver código local mais novo ainda não enviado ao GitHub, comparar esse código com este plano antes de executar alterações. Não sobrescrever solução local correta apenas porque este documento parte da `main` publicada.

---

# 1. Contexto do produto

O SmartGesso evoluiu de um MVP focado em orçamento para um SaaS operacional voltado a profissionais e empresas de gesso e drywall.

Hoje o produto possui, em diferentes níveis de maturidade:

- autenticação e refresh token;  
- multiempresa;  
- usuários e papéis;  
- clientes;  
- obras;  
- medições;  
- catálogo;  
- materiais;  
- composições;  
- orçamentos;  
- PDF e branding;  
- aprovação e rejeição;  
- serviços;  
- status e etapas operacionais;  
- fotos;  
- agenda;  
- produção;  
- estoque;  
- movimentações;  
- pagamentos;  
- parcelas;  
- despesas;  
- notificações;  
- relatórios;  
- offline;  
- testes unitários e E2E web.

A evolução funcional foi positiva, porém o Mobile passou a antecipar alguns contratos que a API ainda não implementa. O resultado é uma aplicação que visualmente parece mais completa do que o domínio realmente persistido.

Fluxo-alvo:

```text  
CLIENTE  
  ↓  
ORÇAMENTO  
  ↓  
APROVAÇÃO  
  ↓  
SERVIÇO  
  ├─ execução  
  ├─ agenda  
  ├─ fotos  
  ├─ materiais  
  ├─ produção, se habilitada  
  ├─ estoque, se habilitado  
  ├─ despesas  
  ├─ recebimentos  
  └─ resultado  
  ↓  
CONCLUSÃO  
  ↓  
GARANTIA / RETORNO  
```

Princípio central:

> **Orçamento é a porta comercial. Serviço é a unidade operacional. Financeiro é consequência do Serviço.**

---

# 2. Objetivos da V5

1. Sincronizar completamente os contratos API ↔ Mobile.  
2. Eliminar funcionalidades visuais sem suporte real no backend.  
3. Tornar aprovação de orçamento idempotente.  
4. Impedir criação duplicada de Serviço.  
5. Corrigir operações compostas que hoje não são totalmente transacionais.  
6. Corrigir versionamento de orçamento.  
7. Tornar sequências numéricas seguras em concorrência.  
8. Vincular recebimentos ao Serviço correto.  
9. Vincular despesas ao Serviço correto.  
10. Tornar resultado financeiro por Serviço confiável.  
11. Aplicar CompanyAccessGuard e PermissionsGuard de forma consistente.  
12. Eliminar fallback inseguro para `COMPANY_OWNER` no Mobile.  
13. Consolidar `PermissionGate`.  
14. Fazer Serviço ser o centro operacional.  
15. Reduzir progressivamente a dependência de `Work/Obra` no fluxo principal.  
16. Tornar Produção e Estoque opcionais conforme plano/capacidade.  
17. Proteger anexos privados.  
18. Redesenhar offline para operações seguras.  
19. Padronizar respostas, erros, paginação e OpenAPI.  
20. Fortalecer testes, CI e observabilidade.

---

# 3. Diagnóstico atual — problemas comprovados

## P0.1 — Aprovação e conversão duplicadas

Backend:

`SmartGesso-API/src/modules/quotes/quotes.service.ts`

O método `approve()` já:

- muda status para APROVADO;  
- cria histórico;  
- cria `ServiceOrder`;  
- grava `convertedAt`.

Mobile:

`SmartGesso-Mobile/app/(app)/orcamentos/[id].tsx`

O Mobile:

1. chama `quotesService.approve()`;  
2. abre um modal;  
3. chama `quotesService.convertToService()`.

Fluxo atual:

```text  
Aprovar  
→ API já cria Serviço  
→ Mobile tenta converter novamente  
→ conflito / 409  
```

**Objetivo:** transformar `approve` na operação canônica e remover a segunda conversão da UX.

---

## P0.2 — Resultado do Serviço usa verbos HTTP diferentes

Mobile:

`POST /service-orders/:id/result`

Backend:

`PATCH /service-orders/:id/result`

**Objetivo:** adotar um contrato único. Recomendação: `PATCH`.

---

## P0.3 — Campos operacionais existem no Mobile, mas não no backend

O Mobile utiliza:

- `pauseReason`;  
- `etapas`;  
- `needsProduction`.

Arquivos principais:

- `SmartGesso-Mobile/src/types/serviceOrder.ts`;  
- `SmartGesso-Mobile/src/services/api/serviceOrders.ts`;  
- `SmartGesso-Mobile/app/(app)/servicos/[id].tsx`.

O backend atual não possui contrato equivalente completo no Prisma/DTO.

Como a API usa `whitelist: true` e `forbidNonWhitelisted: true`, payloads com campos não reconhecidos podem ser rejeitados.

**Objetivo:** implementar persistência real e remover a ideia de campos apenas forward-compatible.

---

## P0.4 — `Expense.serviceOrderId` existe apenas no Mobile

O Mobile já envia `serviceOrderId` em `app/(app)/despesas/novo.tsx`.

Porém:

- `CreateExpenseDto` não possui o campo;  
- `Expense` no Prisma não possui a relação.

**Objetivo:** criar relação real `Expense → ServiceOrder`.

---

## P0.5 — Financeiro do Serviço soma pagamentos pelo cliente

Na tela de Serviço, o Mobile atualmente busca pagamentos da empresa e filtra aproximadamente por:

`payment.clientId \=== order.clientId`

Isso é incorreto quando um cliente possui mais de um Serviço.

Exemplo:

```text  
Cliente João  
OS #10 \= R$ 2.000  
OS #15 \= R$ 5.000  
Pagamento de R$ 2.000 referente à OS #10  
```

A OS #15 não pode considerar esse pagamento como recebido.

**Objetivo:** adicionar `Payment.serviceOrderId` e calcular por Serviço.

---

## P0.6 — Despesas por Serviço não são persistidas

O Mobile filtra `expense.serviceOrderId \=== order.id`, mas a API não possui a relação.

Consequências:

- custo realizado incorreto;  
- lucro incorreto;  
- margem incorreta;  
- relatórios inconsistentes.

---

## P0.7 — Delete fora da transaction

Em `QuotesService.update`, os itens podem ser excluídos antes da transaction.

Em `ServiceOrdersService.update`, materiais podem ser excluídos antes da atualização completa.

Risco:

```text  
delete dados antigos  
→ falha posterior  
→ dados antigos já foram perdidos  
```

**Objetivo:** tornar delete + update + create uma única transaction.

---

## P0.8 — Versionamento de orçamento incorreto

Atual:

`#52 v1 → #53 v2`

Correto:

`#52 v1 → #52 v2`

Duplicação:

`#52 v2 → #53 v1`

---

## P0/P1.9 — Numeração baseada em último + 1

Quote e ServiceOrder buscam o maior código e somam 1.

Em concorrência:

```text  
A lê 57  
B lê 57  
A tenta 58  
B tenta 58  
```

**Objetivo:** `CompanySequence` com incremento atômico.

---

## P0/P1.10 — Segurança SaaS incompleta

Já existem:

- `JwtAuthGuard`;  
- `ActiveCompanyGuard`;  
- `CompanyAccessGuard`;  
- `PermissionsGuard`;  
- `ROLE_PERMISSIONS`.

Porém controllers operacionais analisados continuam utilizando principalmente `JwtAuthGuard + ActiveCompanyGuard`.

Riscos:

- empresa suspensa continuar operando;  
- perfil sem permissão chegar a endpoint protegido;  
- segurança depender da interface.

---

## P1.11 — Dois PermissionGate e fallback owner

Existem:

- `src/components/domain/PermissionGate.tsx`;  
- `src/components/ui/PermissionGate.tsx`.

E existe fallback:

`DEFAULT_COMPANY_PROFILE_ROLE \= COMPANY_OWNER`

Quando o perfil ainda não carregou, o app não deve assumir acesso máximo.

---

## P1.12 — Upload autenticado, leitura pública

O upload exige autenticação, mas `/uploads/*` é servido estaticamente.

Isso é inadequado para:

- fotos de obra;  
- comprovantes;  
- documentos;  
- evidências;  
- fotos de clientes.

---

## P0/P1.13 — Offline financeiro inseguro

O processor atual:

- usa `fetch` diretamente;  
- pode trabalhar com endpoint relativo;  
- não injeta autenticação no request;  
- não usa idempotency key;  
- permite payment/expense.

Risco:

```text  
servidor grava pagamento  
→ resposta se perde  
→ app faz retry  
→ pagamento duplicado  
```

---

## P1.14 — Contratos de lista inconsistentes

Parte do Mobile espera `{ data, total }`, enquanto endpoints reais podem retornar array puro.

Isso gerou `toArray()` em telas.

**Objetivo:** contrato único e adapter apenas na camada API durante transição.

---

## P2.15 — E2E Android não é Android nativo

Playwright com viewport Pixel continua testando navegador/Expo Web.

É útil, mas não substitui APK real.

**Objetivo futuro:** Maestro.

---

# 4. Princípios obrigatórios

1. Não reescrever o projeto do zero.  
2. Preservar NestJS + Prisma + MySQL.  
3. Preservar Expo + React Native + Expo Router.  
4. Preservar React Query.  
5. Zustand apenas para estado global apropriado.  
6. API é fonte da verdade.  
7. Mobile não inventa contrato.  
8. `companyId` sempre deriva do contexto autenticado.  
9. Toda entidade multiempresa deve ser filtrada por empresa.  
10. Mudança de schema exige migration.  
11. Evitar migration destrutiva.  
12. Operações compostas críticas devem ser transacionais.  
13. Operações sujeitas a retry devem ser idempotentes.  
14. Regra financeira deve ser calculada no backend.  
15. Segurança deve ser aplicada no backend.  
16. UI apenas reflete permissão.  
17. Nunca assumir `COMPANY_OWNER` quando role estiver indefinido.  
18. Não remover legado antes de migrar consumidores.  
19. Não adicionar feature fora do plano durante consolidação.  
20. Não avançar deixando regressões críticas.

---

# 5. Ordem de prioridade

## P0 — corrigir antes de novas features

- approve → Serviço;  
- POST/PATCH result;  
- pauseReason;  
- etapas;  
- needsProduction;  
- Expense.serviceOrderId;  
- Payment.serviceOrderId;  
- financeiro por Serviço;  
- transactions;  
- versionamento;  
- sequence;  
- contratos API ↔ Mobile;  
- offline financeiro.

## P1 — antes de produção

- Guards;  
- RBAC;  
- assinatura;  
- PermissionGate;  
- uploads privados;  
- resposta/paginação;  
- feature flags;  
- Work/Obra;  
- observabilidade.

## P2 — evolução

- E2E nativo;  
- aditivos;  
- compras;  
- garantia;  
- follow-up;  
- analytics avançado.

---

# 6. ETAPA 0 — Baseline e congelamento funcional

## Objetivo

Criar uma fotografia confiável do estado atual antes de qualquer alteração.

## API

Executar:

```bash  
npm install  
npm run lint  
npm run typecheck  
npm test  
npm run build  
npx prisma validate  
npx prisma generate  
```

Revisar:

- `git status`;  
- migrations;  
- `.env.example`;  
- alterações locais ainda não commitadas;  
- testes já quebrados antes da V5.

## Mobile

```bash  
npm install  
npm run lint  
npm run typecheck  
npm test  
npm run doctor  
```

Quando aplicável:

`npm run test:e2e`

## Não fazer

- novas features;  
- migration funcional;  
- refatoração ampla.

## Critério de aceite

Separar claramente:

- falhas preexistentes;  
- falhas introduzidas pela V5.

---

# 7. ETAPA 1 — Convergência API ↔ Mobile

## Objetivo

Nenhuma funcionalidade crítica deve existir apenas de um lado.

## 7.1 Aprovação canônica

### Backend — arquivos principais

- `src/modules/quotes/quotes.service.ts`;  
- `src/modules/quotes/quotes.controller.ts`;  
- `prisma/schema.prisma`;  
- testes de quote/service.

### Comportamento alvo

```text  
POST /quotes/:id/approve  
→ aprovar  
→ criar ou recuperar Serviço  
→ retornar quote + serviceOrder  
```

Contrato sugerido:

```json  
{  
  "quote": {},  
  "serviceOrder": {},  
  "serviceOrderCreated": true  
}  
```

### Alterações obrigatórias

1. `approve()` deve ser idempotente.  
2. Orçamento já aprovado deve retornar Serviço existente.  
3. Um orçamento pode possuir no máximo um Serviço principal.  
4. Status + history + Serviço + convertedAt devem ocorrer na mesma transaction.  
5. Criar constraint/index adequado para proteger duplicação.  
6. Tratar registros legados antes de tornar `quoteId` unique.  
7. `convert-to-service` deve delegar para a mesma regra durante compatibilidade.

### Mobile

Arquivos:

- `app/(app)/orcamentos/[id].tsx`;  
- `src/services/api/quotes.ts`;  
- `src/types/quote.ts`.

Remover:

```text  
approve  
→ modal perguntando se deseja converter  
→ convertToService  
```

Novo:

```text  
Aprovar  
→ Serviço criado  
→ botão Abrir serviço  
```

### Testes

- primeira aprovação cria um Serviço;  
- segunda aprovação não cria outro;  
- requests simultâneos não criam duas OS;  
- orçamento cancelado não aprova;  
- tenant diferente não acessa;  
- Mobile navega usando `serviceOrder.id` retornado.

### Aceite

`1 Quote → exatamente 1 ServiceOrder`.

---

## 7.2 Resultado do Serviço

Padronizar em:

`PATCH /service-orders/:id/result`

Alterar Mobile para usar PATCH.

Adicionar teste de contrato.

---

## 7.3 Campos operacionais do Serviço

Se a UX atual for mantida, implementar no backend:

```prisma  
pauseReason     String?  
etapas          Json?  
needsProduction Boolean @default(false)  
```

Atualizar:

- Prisma;  
- migration;  
- `UpdateServiceOrderDto`;  
- `ServiceOrdersService`;  
- Swagger;  
- types Mobile.

Critério:

- marcar etapa;  
- pausar;  
- marcar produção;  
- fechar/reabrir app;  
- valores continuam persistidos.

---

## 7.4 Expense → ServiceOrder

Adicionar relação opcional:

```text  
Expense.serviceOrderId  
Expense.serviceOrder  
```

Atualizar:

- schema;  
- migration;  
- CreateExpenseDto;  
- UpdateExpenseDto;  
- ExpensesService;  
- response;  
- types Mobile.

Regra:

Se `serviceOrderId` for informado, a OS deve existir e pertencer à `companyId` autenticada.

---

## 7.5 Payment → ServiceOrder

Adicionar relação equivalente.

Atualizar:

- schema;  
- migration;  
- CreatePaymentDto;  
- UpdatePaymentDto;  
- PaymentsService;  
- include;  
- types;  
- formulário Mobile.

Se `serviceOrderId` estiver presente:

- OS precisa pertencer à empresa;  
- `clientId` deve corresponder ao cliente da OS.

---

## 7.6 Remover cálculo por cliente

Eliminar `payment.clientId \=== order.clientId` como regra para saldo da OS.

Usar vínculo real por `serviceOrderId`.

---

## Aceite da Etapa 1

- approve idempotente;  
- result funciona;  
- campos operacionais persistem;  
- Expense pertence à OS;  
- Payment pertence à OS;  
- pagamento de uma OS não altera outra;  
- API e Mobile compilam e testam.

---

# 8. ETAPA 2 — Integridade transacional

## Objetivo

Nenhuma falha parcial pode apagar dados válidos.

## Quote.update

A mesma transaction deve conter:

```text  
delete old items  
update quote  
create new items  
write history  
```

## ServiceOrder.update

A mesma transaction deve conter:

```text  
delete old materials  
update service order  
create new materials  
```

## Teste obrigatório

Forçar erro após exclusão e provar rollback completo.

## Aceite

Nenhum registro válido é perdido quando uma operação composta falha.

---

# 9. ETAPA 3 — Versionamento e Sequence

## 9.1 Quote version

Nova versão:

`#52 v1 → #52 v2`

Duplicação:

`#52 v2 → #53 v1`

Preservar `@@unique([companyId, quoteNumber, version])`.

## 9.2 CompanySequence

Criar entidade por empresa/tipo.

Exemplo:

```prisma  
model CompanySequence {  
  id        String @id @default(uuid())  
  companyId String  
  type      String  
  value     Int

  @@unique([companyId, type])  
}  
```

Tipos iniciais:

- QUOTE;  
- SERVICE_ORDER;  
- PRODUCTION_ORDER.

Não aceitar `find last + 1` como solução final.

## Teste

Requests concorrentes devem receber números diferentes.

---

# 10. ETAPA 4 — Financeiro confiável por Serviço

## Objetivo de negócio

Responder com confiança:

> Quanto foi contratado, quanto recebi, quanto falta receber, quanto gastei e quanto ganhei neste Serviço?

## Estratégia V5

Evitar overengineering.

Manter inicialmente:

- Payment;  
- PaymentInstallment;  
- Expense;  
- vínculo de ambos com ServiceOrder.

Não é obrigatório introduzir Receivable/Receipt nesta V5.

## Endpoint recomendado

`GET /service-orders/:id/financial-summary`

Resposta:

```json  
{  
  "contractedValue": 5000,  
  "receivedValue": 2000,  
  "pendingValue": 3000,  
  "expensesValue": 1200,  
  "cashResult": 800,  
  "projectedResult": 3800,  
  "marginPct": 76  
}  
```

Fórmulas:

- `received \= recebimentos confirmados da OS`;  
- `pending \= contracted - received`;  
- `expenses \= despesas da OS`;  
- `cashResult \= received - expenses`;  
- `projectedResult \= contracted - expenses`.

## Mobile

A tela de Serviço deve consumir o summary.

Não deve carregar todos os pagamentos da empresa para calcular localmente.

## Permissões

Custos e margem somente para perfis/permissões financeiras apropriadas.

## Aceite

Pagamento da OS A nunca altera saldo da OS B, mesmo quando o cliente é o mesmo.

---

# 11. ETAPA 5 — Segurança SaaS real

## Objetivo

Garantir autenticação, tenant, assinatura e permissão em todas as rotas relevantes.

## Cadeia recomendada

```text  
JwtAuthGuard  
→ ActiveCompanyGuard  
→ CompanyAccessGuard  
→ PermissionsGuard  
→ Controller  
```

Aplicar conforme finalidade da rota, não mecanicamente.

## Controllers para auditoria

- clients;  
- quotes;  
- service-orders;  
- payments;  
- expenses;  
- inventory;  
- production-orders;  
- measurements;  
- works;  
- schedule;  
- uploads;  
- company-members;  
- dashboard.

## Permissões por endpoint

Exemplos:

```text  
GET quotes              → quotes.read  
POST quotes             → quotes.create  
PATCH quotes            → quotes.update  
POST approve            → quotes.approve  
GET payments            → customer_payments.read  
POST payments           → customer_payments.create  
POST expenses           → expenses.create  
```

## Role e permissions no Mobile

Hoje o Mobile possui fallback `COMPANY_OWNER`.

Eliminar.

O backend deve fornecer role/permissões via `GET /auth/me`, `GET /company/permissions` ou ambos.

Enquanto permission state não estiver carregado:

```text  
loading/unknown  
```

e nunca owner.

## Consolidar PermissionGate

Manter uma única implementação.

Recomendação:

`src/components/domain/PermissionGate.tsx`

Preferir permissão explícita:

```tsx  
\<PermissionGate permission="expenses.create">  
```

em vez de lógica espalhada por papel.

## Empresa suspensa

Mobile deve reagir por `error.code`, não somente HTTP status.

Tratar:

- UNAUTHORIZED;  
- FORBIDDEN;  
- COMPANY_ACCESS_DENIED;  
- COMPANY_ACCESS_SUSPENDED;  
- SUBSCRIPTION_GRACE_PERIOD.

Não entrar em loop de refresh.

## Aceite

- tenant A não acessa tenant B;  
- empresa suspensa não opera;  
- SALES não executa ação financeira proibida;  
- INSTALLER não recebe custo/margem sem permissão;  
- Mobile não assume owner.

---

# 12. ETAPA 6 — Serviço como centro operacional

## Objetivo

Concentrar o dia a dia da empresa na tela do Serviço.

## Fluxo normal

```text  
Orçamento aprovado  
→ Serviço  
```

## Serviço manual

A rota `/servicos/novo` não deve ser o fluxo principal.

Opção recomendada para MVP:

- esconder criação manual normal;  
- permitir posteriormente `Serviço avulso` somente como exceção para owner/manager.

## Status

Manter simples:

- PENDENTE;  
- EM_DESLOCAMENTO;  
- EM_ANDAMENTO;  
- PAUSADA;  
- CONCLUIDA;  
- CANCELADA.

## Etapas

Se `etapas` continuar Json, estabelecer schema estável.

Exemplo:

```json  
{  
  "medicao": true,  
  "materialSeparado": true,  
  "instalacao": false,  
  "acabamento": false,  
  "limpeza": false,  
  "entrega": false  
}  
```

Não aceitar chaves arbitrárias sem controle de versão indefinidamente.

---

# 13. ETAPA 7 — Produção e Estoque opcionais

## Contexto

Produção faz sentido para algumas empresas e gera ruído para outras.

O modelo `Plan.features` já existe e deve ser aproveitado.

Exemplo:

```json  
{  
  "production": true,  
  "inventory": true,  
  "team": true,  
  "advancedReports": false  
}  
```

## Regra Mobile

Exibir módulo quando:

```text  
feature habilitada  
+  
permission permitida  
```

`needsProduction` só aparece se Produção estiver habilitada.

---

# 14. ETAPA 8 — Simplificar Obra e Medições

## Problema

O novo orçamento ainda depende de:

- Work;  
- workId;  
- WorkPickerModal;  
- `measurementsService.listByWork()`.

Para muitos gesseiros isso adiciona uma entidade administrativa desnecessária.

## Estado futuro

```text  
Cliente  
→ Orçamento  
→ Local  
→ Ambientes  
→ Medições  
```

## QuoteEnvironment

Criar progressivamente entidade semelhante a:

```text  
QuoteEnvironment  
- id  
- companyId  
- quoteId  
- name  
- type  
- observations  
```

Measurement passa a poder pertencer ao ambiente.

## Migração progressiva

1. Introduzir QuoteEnvironment.  
2. Permitir medição sem Work.  
3. Migrar wizard novo.  
4. Manter leitura de dados antigos.  
5. Remover Work somente em versão futura.

Não apagar Work no mesmo deploy em que a substituição é criada.

---

# 15. ETAPA 9 — Refatorar wizard de Orçamento

O arquivo `app/(app)/orcamentos/novo.tsx` concentra responsabilidades demais.

Estrutura alvo:

```text  
src/features/quotes/create/  
├── CreateQuoteScreen.tsx  
├── types.ts  
├── validation.ts  
├── utils.ts  
├── hooks/  
│   ├── useQuoteDraft.ts  
│   ├── useQuoteWizard.ts  
│   ├── useMaterialCalculation.ts  
│   └── useQuoteSubmit.ts  
├── components/  
│   ├── QuickClientModal.tsx  
│   └── EnvironmentEditor.tsx  
└── steps/  
    ├── ClientStep.tsx  
    ├── LocationStep.tsx  
    ├── EnvironmentsStep.tsx  
    ├── ItemsStep.tsx  
    ├── PricingStep.tsx  
    ├── DeadlineStep.tsx  
    ├── PaymentStep.tsx  
    └── ReviewStep.tsx  
```

## Regra

Refatoração estrutural não pode alterar regra comercial válida sem intenção explícita.

Rota Expo Router deve ficar fina e delegar à feature.

---

# 16. ETAPA 10 — Uploads privados

## Objetivo

Fotos e comprovantes não podem depender de URL pública estática.

## Criar Attachment

Campos sugeridos:

- id;  
- companyId;  
- entityType;  
- entityId;  
- category;  
- storageKey;  
- mimeType;  
- size;  
- createdBy;  
- createdAt.

## Storage abstraction

Criar `StorageProvider`.

Implementação inicial pode continuar local, mas a API deve desacoplar o domínio do disco.

Futuro:

- S3;  
- Cloudflare R2;  
- outro compatível.

## Leitura

Evitar `/uploads/arquivo.jpg` público.

Preferir:

`GET /attachments/:id/download`

com autorização, ou URL assinada curta.

## Segurança

Antes de anexar a `entityId`, validar que a entidade pertence à empresa ativa.

---

# 17. ETAPA 11 — Offline seguro

## Diretriz

Não considerar offline pronto apenas porque existe fila.

## Permitido na V5

- rascunhos;  
- observações;  
- checklist;  
- medições;  
- fotos pendentes;  
- operações operacionais idempotentes.

## Bloquear temporariamente

- pagamento;  
- recebimento;  
- despesa;  
- aprovação;  
- movimentação crítica de estoque;  
- exclusão sensível.

## Processor

Usar client autenticado da aplicação.

Não usar `fetch` relativo sem base URL/token.

## Idempotency

Antes de reativar financeiro offline, implementar `Idempotency-Key` no backend.

O retry do mesmo comando deve retornar o resultado original ou rejeitar duplicidade sem gravar novamente.

---

# 18. ETAPA 12 — Menu e UX

Preservar bottom navigation:

```text  
Início  
Orçamentos  
Novo  
Serviços  
Mais  
```

## Simplificar Mais

Remover Orçamentos e Serviços de Mais, pois já são tabs.

Eliminar duplicidade entre Pagamentos e Cobranças quando ambos apontarem ao mesmo lugar.

Estrutura recomendada:

```text  
OPERAÇÃO  
Clientes  
Agenda  
Estoque*  
Produção*

FINANCEIRO  
Financeiro  
Despesas

GESTÃO  
Relatórios  
Equipe*

CONTA  
Empresa  
Configurações  
Perfil

SUPORTE  
Ajuda  
Trocar empresa  
Sair  
```

`*` somente se feature/permissão permitir.

## Financeiro

Preferir uma área consolidada com:

- Recebimentos;  
- A receber;  
- Despesas.

---

# 19. ETAPA 13 — Contratos, erros, paginação e OpenAPI

## Erro padrão

```json  
{  
  "statusCode": 403,  
  "code": "FORBIDDEN",  
  "message": "Permissão insuficiente",  
  "details": {}  
}  
```

Códigos mínimos:

- UNAUTHORIZED;  
- FORBIDDEN;  
- VALIDATION_ERROR;  
- NOT_FOUND;  
- CONFLICT;  
- RATE_LIMITED;  
- COMPANY_ACCESS_DENIED;  
- COMPANY_ACCESS_SUSPENDED;  
- SUBSCRIPTION_GRACE_PERIOD.

## Paginação

Contrato recomendado:

```json  
{  
  "data": [],  
  "pagination": {  
    "page": 1,  
    "pageSize": 20,  
    "total": 0,  
    "totalPages": 0  
  }  
}  
```

Durante migração, adapters ficam em `src/services/api`, nunca espalhados nas telas.

## OpenAPI

Atualizar DTOs Swagger e transformar `npm run api:generate` em geração real quando os contratos estabilizarem.

Objetivo:

```text  
OpenAPI  
→ tipos/client gerados  
→ menos divergência API ↔ Mobile  
```

---

# 20. ETAPA 14 — Testes

## Backend — obrigatório

### Quote

- approve idempotente;  
- approve concorrente;  
- createVersion;  
- duplicate;  
- rollback de items.

### ServiceOrder

- result;  
- status;  
- etapas;  
- pauseReason;  
- needsProduction;  
- rollback de materials.

### Financeiro

- Payment.serviceOrderId;  
- Expense.serviceOrderId;  
- parcelas;  
- financial summary;  
- pagamentos de OS diferentes;  
- tenant isolation.

### Segurança

- tenant A não acessa B;  
- role matrix;  
- empresa suspensa;  
- endpoints financeiros;  
- uploads.

## Mobile

- services API;  
- error mapper;  
- financial summary;  
- PermissionGate;  
- offline queue;  
- approve flow.

## E2E Web

Manter Playwright, mas estabilizar com `testID` reais.

## E2E nativo futuro

Adicionar Maestro para:

- login;  
- criar orçamento;  
- aprovar;  
- abrir Serviço;  
- registrar despesa;  
- registrar recebimento.

---

# 21. ETAPA 15 — Observabilidade e produção

Adicionar structured logging com:

- requestId;  
- companyId;  
- userId quando adequado;  
- route;  
- duração;  
- status;  
- error code.

Nunca registrar:

- senha;  
- access token;  
- refresh token;  
- segredos;  
- conteúdo sensível desnecessário.

Separar:

- `/health`;  
- `/readiness`.

Readiness deve validar dependências essenciais, principalmente banco.

---

# 22. ETAPA 16 — Limpeza de legado

Somente após migração completa.

Revisar:

- `convert-to-service`;  
- criação manual normal de Serviço;  
- Work antigo;  
- `toArray`;  
- PermissionGate duplicado;  
- tipos forward-compatible;  
- comentários V3 desatualizados;  
- endpoints sem consumidor.

Nunca remover algo apenas porque parece antigo. Provar ausência de consumidor.

---

# 23. O que NÃO adicionar agora

Até a V5 estabilizar, não priorizar:

- IA;  
- chatbot;  
- CRM avançado;  
- assinatura eletrônica;  
- NF-e;  
- integração bancária;  
- roteirização;  
- WhatsApp automatizado complexo;  
- microserviços;  
- marketplace;  
- geolocalização avançada;  
- analytics sofisticado.

O SmartGesso já possui escopo suficiente para validação de mercado.

---

# 24. Melhorias após a V5

Quando a base estiver estável:

1. aditivos de Serviço;  
2. fornecedores;  
3. compras;  
4. garantia/retorno;  
5. follow-up comercial;  
6. motivo estruturado de perda;  
7. indicadores de conversão;  
8. dashboard por período;  
9. DRE simplificada;  
10. assinatura digital;  
11. automações.

---

# 25. Critérios globais de aceite

A V5 só termina quando:

1. API e Mobile usam os mesmos contratos críticos.  
2. Nenhum campo operacional relevante existe somente no Mobile.  
3. Approve cria no máximo um Serviço.  
4. Segunda aprovação é idempotente.  
5. Resultado do Serviço usa mesmo endpoint/verbo.  
6. pauseReason persiste.  
7. etapas persistem.  
8. needsProduction persiste.  
9. Expense pode pertencer à OS.  
10. Payment pode pertencer à OS.  
11. Serviço calcula recebido apenas de seus pagamentos.  
12. Serviço calcula custo apenas de suas despesas.  
13. Updates compostos possuem rollback.  
14. Nova versão mantém quoteNumber.  
15. Duplicação gera novo quoteNumber.  
16. Sequência é segura em concorrência.  
17. Empresa suspensa não opera módulos protegidos.  
18. Permissões são verificadas no backend.  
19. Mobile não assume COMPANY_OWNER.  
20. Há um único PermissionGate coerente.  
21. Upload privado exige autorização.  
22. Offline financeiro não duplica registros.  
23. Listas e erros estão padronizados.  
24. Wizard está modularizado.  
25. Produção/Estoque podem ser opcionais.  
26. Testes críticos estão verdes.  
27. Build da API está verde.  
28. Typecheck Mobile está verde.

---

# 26. Ordem automática de execução

```text  
ETAPA 0  Baseline  
↓  
ETAPA 1  Convergência API ↔ Mobile  
↓  
ETAPA 2  Transactions  
↓  
ETAPA 3  Versionamento + Sequence  
↓  
ETAPA 4  Financeiro por Serviço  
↓  
ETAPA 5  Segurança SaaS  
↓  
ETAPA 6  Serviço como centro  
↓  
ETAPA 7  Feature flags  
↓  
ETAPA 8  Ambientes/Medições  
↓  
ETAPA 9  Wizard  
↓  
ETAPA 10 Attachments  
↓  
ETAPA 11 Offline  
↓  
ETAPA 12 UX/Menu  
↓  
ETAPA 13 Contratos/OpenAPI  
↓  
ETAPA 14 Testes  
↓  
ETAPA 15 Observabilidade  
↓  
ETAPA 16 Legado  
```

---

# 27. Regras para execução autônoma

O agente deve:

- avançar automaticamente entre etapas;  
- validar antes de avançar;  
- não perguntar se deve continuar após cada fase;  
- não deixar testes quebrados;  
- implementar backend antes do Mobile quando existir dependência;  
- revisar `git diff` a cada etapa;  
- preservar dados;  
- não usar force push;  
- não remover migration aplicada;  
- não editar `.env` real;  
- não inserir segredos;  
- não inventar requisito.

Só parar diante de:

- risco real de perda irreversível;  
- credencial indispensável ausente;  
- migration destrutiva sem estratégia de preservação;  
- contradição de regra de negócio impossível de resolver pelo código/documentação.

---

# 28. `/goal` mestre para Hermes

Executar a partir da pasta pai:

```text  
SmartGesso/  
├── SmartGesso-API/  
└── SmartGesso-Mobile/  
```

Prompt:

```text  
/goal draft

Atue como engenheiro de software sênior responsável pela Consolidação V5 do SmartGesso.

Você deve trabalhar de forma AUTÔNOMA, SEQUENCIAL e COORDENADA nos dois projetos:

BACKEND  
./SmartGesso-API

MOBILE  
./SmartGesso-Mobile

ESPECIFICAÇÃO AUTORITATIVA  
./SmartGesso-API/docs/PLANO_CONSOLIDACAO_V5_SMARTGESSO.md

Leia integralmente o documento antes de alterar código.

OBJETIVO GLOBAL

Executar todo o Plano de Consolidação V5 até que API e Mobile estejam coerentes, integrados, seguros e com todos os critérios globais de aceite atendidos.

PRINCÍPIO CENTRAL

Orçamento é a porta comercial.  
Serviço é a unidade operacional.  
Financeiro é consequência do Serviço.

ORDEM OBRIGATÓRIA

Siga exatamente a ordem das etapas do documento.

Quando o Mobile depender de contrato novo:

1. implemente Backend;  
2. crie migration quando necessário;  
3. valide Prisma;  
4. atualize DTO/service/controller;  
5. adicione testes;  
6. rode lint/typecheck/test/build;  
7. somente então altere Mobile;  
8. atualize types/services/hooks/telas;  
9. rode lint/typecheck/test;  
10. valide integração;  
11. avance automaticamente.

NÃO pare ao final de cada etapa para pedir autorização.

REGRAS ABSOLUTAS

- não reescrever do zero;  
- não introduzir microserviços;  
- preservar NestJS/Prisma/MySQL;  
- preservar Expo/React Native/Expo Router;  
- backend é autoridade de regra de negócio;  
- frontend não inventa contrato;  
- companyId sempre deriva do contexto autenticado;  
- migrations devem preservar dados;  
- operações críticas devem ser transacionais;  
- retry crítico exige idempotência;  
- não expor arquivo privado;  
- não assumir COMPANY_OWNER quando role estiver ausente;  
- não adicionar feature fora do plano;  
- não deixar testes quebrados;  
- não fazer force push;  
- não versionar segredo.

VALIDAÇÃO BACKEND

npm run lint  
npm run typecheck  
npm test  
npm run build  
npx prisma validate  
npx prisma generate

VALIDAÇÃO MOBILE

npm run lint  
npm run typecheck  
npm test  
npm run doctor

Execute E2E quando a etapa alterar fluxo coberto.

CHECKPOINT INTERNO APÓS CADA ETAPA

- revisar git diff;  
- listar arquivos alterados;  
- confirmar migrations;  
- confirmar testes;  
- confirmar contratos;  
- corrigir erros;  
- avançar automaticamente.

CRITÉRIO FINAL

Não considere o goal concluído até que TODOS os critérios globais de aceite do documento estejam atendidos.

Ao final, gerar relatório separado em BACKEND, MOBILE e INTEGRAÇÃO, informando arquivos, migrations, endpoints, contratos, testes, legado mantido, riscos residuais e recomendações.

Não pergunte se deve avançar entre etapas. Avance automaticamente.  
```

---

# 29. Checklist manual final

## Fluxo 1 — Orçamento

```text  
login  
→ empresa  
→ cliente  
→ novo orçamento  
→ itens  
→ prazo  
→ pagamento  
→ PDF  
→ aprovar  
→ Serviço criado  
→ abrir Serviço  
```

Validar:

- somente um Serviço;  
- dados preservados;  
- total correto.

## Fluxo 2 — Serviço

```text  
Serviço  
→ iniciar  
→ etapas  
→ pausar  
→ retomar  
→ fotos  
→ concluir  
```

Fechar e reabrir para validar persistência.

## Fluxo 3 — Financeiro

```text  
OS A → pagamento 1.000  
OS B → pagamento 2.000  
```

A deve mostrar 1.000 e B deve mostrar 2.000.

## Fluxo 4 — Despesa

Despesa de 300 vinculada à OS A deve aparecer somente na OS A.

## Fluxo 5 — Segurança

Testar:

- COMPANY_OWNER;  
- MANAGER;  
- SALES;  
- FINANCE;  
- INSTALLER;  
- PRODUCTION.

## Fluxo 6 — Multiempresa

Empresa A não pode acessar por ID recursos da Empresa B:

- cliente;  
- orçamento;  
- Serviço;  
- pagamento;  
- despesa;  
- anexo.

---

# 30. Recomendações finais de produto

## 30.1 Não aumentar escopo agora

O SmartGesso já tem funcionalidade suficiente para validar mercado.

Agora o valor vem de:

```text  
confiabilidade  
→ simplicidade  
→ velocidade  
→ dados corretos  
```

e não da quantidade de telas.

## 30.2 Serviço como unidade principal

A tela do Serviço deve responder rapidamente:

- Quem?  
- Onde?  
- Quanto?  
- Quando?  
- Em que etapa?  
- O que falta?  
- Quanto recebeu?  
- Quanto gastou?  
- Quanto ganhou?

## 30.3 Financeiro simples e correto

Para o usuário:

```text  
Valor do Serviço  
Recebido  
A receber  
Despesas  
Resultado  
```

É melhor do que criar contabilidade complexa cedo demais.

## 30.4 Produção opcional

O SmartGesso deve atender tanto o gesseiro autônomo quanto uma empresa estruturada sem forçar módulos irrelevantes.

## 30.5 Offline seletivo

Funcionar offline não significa permitir toda operação offline.

Priorizar campo e operação não financeira.

---

# 31. Definição de sucesso

Quando a V5 terminar, o SmartGesso deve deixar de parecer um conjunto crescente de funcionalidades e passar a se comportar como um produto único, coerente, seguro, rastreável, simples de usar e preparado para evoluir.

Essa consolidação deve acontecer antes da próxima grande rodada de funcionalidades.  
