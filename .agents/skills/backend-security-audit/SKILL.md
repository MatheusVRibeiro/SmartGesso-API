---
name: backend-security-audit
description: Auditoria de segurança em APIs NestJS com foco em multi-tenancy estrito, autorização de rotas, isolamento de dados por empresa e separação de tokens de plataforma e tenant.
---

# Backend Security Audit Skill

Esta skill define os procedimentos obrigatórios para auditar e garantir a segurança do backend, com foco especial em arquitetura multi-tenant, controle de acesso baseado em funções (RBAC) e proteção contra vazamento de dados entre empresas.

---

## 🛡️ Regras de Ouro de Segurança

1. **Nunca confie em `companyId` do corpo ou parâmetros da requisição:**
   - Em rotas protegidas (web e mobile), o `companyId` DEVE ser extraído exclusivamente do token JWT autenticado ou da sessão resolvida pelo Guard (`req.user.companyId`).
   - Se o usuário tentar passar um `companyId` no body de um `POST`/`PUT`/`PATCH`, descarte ou valide explicitamente se coincide com a empresa autenticada.

2. **Separação estrita de tokens e perfis:**
   - **Superadmin / Plataforma:** Guards específicos (`PlatformAdminGuard`), rotas isoladas (`/admin/*`).
   - **Usuário da Empresa:** Guards de tenant (`TenantAuthGuard`, `JwtAuthGuard`).
   - **NUNCA** permita que um token de usuário comum acesse rotas de administração global da plataforma, e nunca misture os segredos de assinatura de JWT se forem distintos.

3. **Multi-tenancy em TODAS as queries do Prisma:**
   - Todas as operações de leitura, atualização e exclusão DEVEM conter `companyId: authenticatedCompanyId` na cláusula `where`.
   - Cuidado redobrado com operações por ID único: `prisma.item.findFirst({ where: { id, companyId } })` em vez de `prisma.item.findUnique({ where: { id } })` (a menos que a chave composta seja `id_companyId`).

---

## 📋 Checklist de Auditoria para Endpoints

Antes de aprovar ou finalizar qualquer novo endpoint ou alteração:

- [ ] **Autenticação:** O endpoint está protegido pelo guard apropriado (`@UseGuards(JwtAuthGuard, RolesGuard)`)?
- [ ] **Origem do Tenant:** O `companyId` está vindo do usuário logado via decorator (`@CurrentUser()`, `@CurrentCompany()`) e não de `req.body`?
- [ ] **Ownership Check:** Ao buscar, atualizar ou deletar entidades filhas (ex: orçamentos, ordens de serviço, clientes, ambientes), é verificado se pertencem à empresa do solicitante?
- [ ] **Sanitização de Resposta:** Dados sensíveis (senhas com hash, tokens de redefinição, segredos bancários/Pix) estão sendo omitidos na resposta?
- [ ] **Validação de Entrada:** O DTO possui `@IsNotEmpty()`, `@IsUUID()`, `@IsString()`, etc., e o `ValidationPipe` global está ativo com `whitelist: true` e `forbidNonWhitelisted: true`?
- [ ] **Rate Limiting:** Endpoints críticos de autenticação (`/auth/login`, `/auth/forgot-password`) possuem proteção contra força bruta?

---

## 🛑 Padrões Incorretos vs. Corretos

### ❌ Incorreto (Vulnerável a IDOR e quebra de multi-tenancy)
```typescript
@Patch(':id')
async update(@Param('id') id: string, @Body() dto: UpdateServiceOrderDto) {
  // Vulnerabilidade: qualquer usuário autenticado pode alterar a OS de outra empresa!
  return this.serviceOrdersService.update(id, dto);
}
```

### ✅ Correto (Isolamento por Empresa)
```typescript
@Patch(':id')
async update(
  @Param('id') id: string,
  @CurrentUser() user: AuthenticatedUser,
  @Body() dto: UpdateServiceOrderDto,
) {
  return this.serviceOrdersService.update(id, user.companyId, dto);
}
```

E no Service:
```typescript
async update(id: string, companyId: string, dto: UpdateServiceOrderDto) {
  const existing = await this.prisma.serviceOrder.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    throw new NotFoundException('Ordem de serviço não encontrada.');
  }

  return this.prisma.serviceOrder.update({
    where: { id: existing.id },
    data: dto,
  });
}
```
