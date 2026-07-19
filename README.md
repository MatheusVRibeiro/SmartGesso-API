# SmartGesso API

Backend REST independente para o SaaS multiempresa SmartGesso, consumido por `smartgesso-mobile` e pelo futuro `smartgesso-admin-web`.

## Stack

Node.js, NestJS, TypeScript estrito, Prisma ORM, MySQL externo/Hostinger, JWT com refresh token rotativo, Argon2id, Swagger/OpenAPI, Helmet, CORS, rate limiting, Jest e Supertest.

## Execução

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run start:dev
```

Swagger: `http://localhost:3000/docs`.

## Scripts principais

- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, `npm run build`
- `npm run db:generate`, `npm run db:migrate`, `npm run db:migrate:deploy`, `npm run db:seed`
- `npm run openapi:export`

## Etapa 2 em andamento

A etapa 2 separa a aplicação em módulos NestJS reais e inicia a preparação para persistência Prisma/MySQL no lugar da store em memória. Consulte `docs/STAGE_2.md` para a ordem de refatoração e regras de multiempresa.

## Endpoints fase 1

### Plataforma (`/api/v1/platform/*`)

- `POST /platform/auth/login`, `POST /platform/auth/refresh`, `POST /platform/auth/logout`, `GET /platform/auth/me`
- `POST /platform/companies`, `GET /platform/companies`, `GET/PATCH /platform/companies/:id`
- `POST /platform/companies/:id/suspend`, `reactivate`, `block`
- `POST /platform/companies/:id/owner-invitations`, `resend-owner-invitation`
- `POST/GET/PATCH /platform/plans`
- `POST /platform/companies/:companyId/subscriptions`
- `POST /platform/subscriptions/:id/renew|suspend|reactivate|cancel`
- `POST /platform/subscriptions/:id/installments/generate`
- `POST /platform/subscription-installments/:id/payments|cancel`

### Mobile (`/api/v1/*`)

- `POST /auth/accept-invitation`, `POST /auth/login`, `GET /auth/me`, `GET /auth/companies`, `POST /auth/switch-company`
- `GET/PATCH /company/profile`, `GET/PATCH /company/branding`, `GET /company/access-status`, `GET /company/permissions`

## Segurança e multiempresa

A API separa `PlatformAdminGuard` dos guards mobile (`JwtAuthGuard`, `ActiveCompanyGuard`, `CompanyAccessGuard`, `PermissionsGuard`). Rotas mobile usam o contexto autenticado para a empresa ativa e retornam status resumido de assinatura sem expor valores ou receitas da plataforma.

## Produção na Hostinger sem Docker

O projeto está preparado para usar MySQL externo da Hostinger. Configure `DATABASE_URL` no `.env` com o host, usuário, senha e banco criados no painel da hospedagem. Os scripts `db:up`, `db:down` e `db:logs` não dependem de Docker; eles apenas orientam que o banco é gerenciado fora da API. Consulte `docs/DEPLOY_HOSTINGER.md` para o passo a passo.
