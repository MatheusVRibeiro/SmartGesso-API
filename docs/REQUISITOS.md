# Análise de Requisitos — SmartGesso API

> **Propósito deste arquivo:** dar à IA (ou qualquer dev novo) o contexto COMPLETO do produto antes de tocar no código. Leia antes de qualquer tarefa. Complementa os docs técnicos (ARCHITECTURE.md, ROADMAP.md); aqui o foco é PRODUTO + REQUISITOS.
> Última atualização: 28/08/2026
> Fonte principal: código real (src/modules/*, prisma/schema.prisma, package.json) + docs existentes.

---

## 1. Visão Geral

**Objetivo do projeto:** O **SmartGesso** é um SaaS multi-tenant para empresas de gesso e drywall (1–10 funcionários). A API gerencia todo o ciclo de negócio: empresas (tenants), planos e assinaturas, clientes, obras, catálogo de serviços/materiais, orçamentos (com aprovação), ordens de serviço, pagamentos e recebíveis, despesas, agenda, estoque, compras, metas e notificações. Este repositório é o **backend NestJS** que serve o Admin Web (Next.js) e o Mobile (Expo).

**Público-alvo / usuários:** Empresas de gesso/drywall (tenants) e seus colaboradores com papéis definidos (proprietário, gerente, vendas, financeiro, instalador, produção).

**Tipo:** SaaS multi-tenant (API REST, NestJS).

**Status:** Ativo em desenvolvimento — branch `docs-smartgesso-refactor-2026-08-24`. ROADMAP 8 fases ✅. Deploy Hostinger (sem Docker, MySQL externo).

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Runtime | Node.js | ≥22 |
| Linguagem | TypeScript (strict) | ^5.8.3 |
| Framework | NestJS | ^11.1 |
| Banco de dados | MySQL | 8.4 (Hostinger, externo) |
| ORM | Prisma | ^6.12/6.19 |
| Autenticação | JWT access 15min / refresh 30d rotativo + Argon2 | |
| Validação | class-validator + Zod | |
| Testes | Jest | ^30 |
| Deploy | Hostinger (sem Docker) | |
| Segurança | Helmet, Throttler, CORS allowlist fail-closed | |

*Versões reais do package.json.*

---

## 3. Atores / Papéis

| Ator | Descrição | Permissões principais |
|------|-----------|----------------------|
| `platform_admin` | Administrador da plataforma | Gerencia empresas, planos, contratos, admins, auditoria |
| `COMPANY_OWNER` | Proprietário da empresa/tenant | Tudo dentro do tenant |
| `MANAGER` | Gerente | Operação do tenant |
| `SALES` | Vendas | Orçamentos, clientes, obras |
| `FINANCE` | Financeiro | Pagamentos, recebíveis, despesas |
| `INSTALLER` | Instalador | Ordens de serviço (campo) |
| `PRODUCTION` | Produção | Ordens de produção |

*Matriz completa em `src/modules/core/company-permissions.ts` (ROLE_PERMISSIONS).*

---

## 4. Requisitos Funcionais (RF)

> Formato: `RF-XX` — título — descrição. 35 módulos em `src/modules/`.

### Módulo: Auth & Platform
- **RF-01** — Autenticação empresa — login com JWT access (15min) + refresh (30d) rotativo, senha Argon2
- **RF-02** — Autenticação plataforma — admin da plataforma com tokens separados dos tokens de empresa
- **RF-03** — Password reset — fluxo forgot/reset (⚠️ stubs na API — pendência conhecida)
- **RF-04** — Convite de membro — convite por e-mail com aceite

### Módulo: Empresas & Planos
- **RF-05** — CRUD empresas (tenants) — plataforma cria/gerencia empresas
- **RF-06** — Planos e assinaturas — planos com feature flags: `production, inventory, purchases, team, advancedFinance, warranty, pushNotifications, customBranding`
- **RF-07** — CompanyFeatureOverride — override de features por empresa
- **RF-08** — Suspensão de empresa — suspender ≠ excluir (dados preservados)

### Módulo: Orçamentos (core do negócio)
- **RF-09** — Wizard de orçamento — 8 etapas: Cliente → Local → Ambientes → Serviço/Materiais → Valores → Prazo → Pagamento → Revisão
- **RF-10** — Ciclo de status — `RASCUNHO → PRONTO_PARA_ENVIAR → ENVIADO → AGUARDANDO_APROVACAO → APROVADO/REJEITADO/VENCIDO/CANCELADO`
- **RF-11** — Aprovação cria ServiceOrder — idempotente (`ensureServiceOrderFromQuote`)
- **RF-12** — Deep links públicos — `/public/quotes/:token`, `/quotes/:id/share`, `/quotes/by-token/:token`
- **RF-13** — Quote follow-ups — cron 08:00 com follow-ups automáticos

### Módulo: Ordens de Serviço & Produção
- **RF-14** — Ciclo de OS — `PENDENTE → EM_DESLOCAMENTO → EM_ANDAMENTO → PAUSADA → CONCLUIDA/CANCELADA`
- **RF-15** — Service additions — adicionais, garantias e retornos de serviço

### Módulo: Financeiro
- **RF-16** — Pagamentos e recebíveis — `service-receivables`, `payments`
- **RF-17** — Despesas — `expenses`

### Módulo: Operações
- **RF-18** — Agenda — agendamento (`schedule`)
- **RF-19** — Estoque — `inventory` (feature flag)
- **RF-20** — Compras — `purchase-orders`, `suppliers` (feature flag)
- **RF-21** — Catálogo — `catalog`, `measurements`, `compositions`
- **RF-22** — Metas — `goals` (feature flag team)

### Módulo: Transversais
- **RF-23** — Notificações push — expo-server-sdk
- **RF-24** — Uploads e anexos — `uploads`, `attachments`
- **RF-25** — Audit log — `audit-log` (AuditLogService.log)
- **RF-26** — Dashboard — `dashboard`, `company-dashboard`
- **RF-27** — Health — `health` endpoint

---

## 5. Requisitos Não-Funcionais (RNF)

| Código | Categoria | Requisito |
|--------|-----------|-----------|
| RNF-01 | Multi-tenant | TODAS as queries escopadas por `companyId` do contexto autenticado (NUNCA do body) |
| RNF-02 | Precisão monetária | `Decimal(15,2)` para dinheiro, `Decimal(15,3)` para quantidades; moeda BRL |
| RNF-03 | Segurança | Throttler global 100 req/min, endpoints públicos 5 req/min; CORS allowlist fail-closed; Helmet; Swagger só em dev |
| RNF-04 | Fusos | Fuso `America/Sao_Paulo`; datas armazenadas em UTC |
| RNF-05 | Idioma | Interface e comunicação em PT-BR |
| RNF-06 | Logs | Audit log de ações sensíveis |

---

## 6. Regras de Negócio

1. **RN-01** — Orçamento → Aprovação → Serviço: não criar OS manual sem orçamento aprovado
2. **RN-02** — Multi-tenant: `companyId` SEMPRE do contexto autenticado, nunca do body da requisição
3. **RN-03** — Dinheiro em `Decimal(15,2)` BRL — nunca float
4. **RN-04** — Tokens de plataforma separados dos tokens de empresa
5. **RN-05** — Suspensão de empresa ≠ exclusão (dados preservados, acesso revogado)
6. **RN-06** — Mensalidades da plataforma ≠ pagamentos de clientes finais (fluxos separados)
7. **RN-07** — Aprovação de orçamento cria ServiceOrder de forma idempotente

---

## 7. Integrações Externas

| Integração | Para quê | Como |
|------------|----------|------|
| Expo Push | Notificações push mobile | expo-server-sdk |
| Hostinger MySQL | Banco de dados | Prisma (externo, sem Docker) |

---

## 8. Fluxos Principais (User Stories resumidas)

- **Como vendedor, eu quero criar um orçamento em 8 etapas, para enviar ao cliente e acompanhar a aprovação.**
  - Fluxo: wizard → status ENVIADO → cliente aprova via deep link → API cria ServiceOrder automaticamente.
- **Como instalador, eu quero ver minhas OS no campo, para executar e marcar como concluída.**
  - Fluxo: OS criada → EM_DESLOCAMENTO → EM_ANDAMENTO → CONCLUIDA.

---

## 9. Fora de Escopo / Restrições

- **Gap conhecido:** Admin Web consome `/platform/admins` e `/platform/audit`, mas **não existem rotas correspondentes na API** (só AuditLogService.log) — pendência real
- `forgot/reset-password` são stubs na API
- Deploy sem Docker (Hostinger) — sem contêineres
- Docs API.md/ARCHITECTURE.md/MULTITENANCY.md/SECURITY.md/DATABASE.md/SUBSCRIPTIONS.md são stubs de 8 linhas (não são referência confiável)

---

## 10. Referências

- `docs/ROADMAP.md` — plano de evolução (8 fases ✅)
- `docs/PLANO_REFATORACAO_BACKEND_V4.md` — plano do refactor V4
- `docs/DEPLOY_HOSTINGER.md` — deploy
- Admin Web: `../SmartGesso-Adm` (Next.js)
- Mobile: `../SmartGesso-Mobile` (Expo)
