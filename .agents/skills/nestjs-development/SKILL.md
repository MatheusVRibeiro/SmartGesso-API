---
name: nestjs-development
description: Padrões arquiteturais para desenvolvimento em NestJS, incluindo organização modular, DTOs com validação estrita, injeção de dependências, tratamento de exceções e testes.
---

# NestJS Development Skill

Esta skill define os padrões oficiais para implementação de módulos, controllers, services, DTOs e entidades no ecossistema NestJS da aplicação.

---

## 🏗️ Padrões de Arquitetura e Estrutura de Módulos

1. **Separação de Responsabilidades:**
   - **Controllers:** Responsáveis apenas por receber a requisição HTTP, extrair dados autenticados (`@CurrentUser()`), validar payloads via DTO e delegar para o Service. Zero regra de negócio ou query de banco direta.
   - **Services:** Contêm as regras de negócio, transações, orquestração e chamadas ao Prisma/repositório.
   - **DTOs (Data Transfer Objects):** Classes para entrada e saída de dados com validações explícitas.

2. **Organização de Pastas do Módulo:**
   ```text
   src/modules/<nome-modulo>/
   ├── dto/
   │   ├── create-<nome>.dto.ts
   │   └── update-<nome>.dto.ts
   ├── <nome-modulo>.controller.ts
   ├── <nome-modulo>.service.ts
   ├── <nome-modulo>.module.ts
   └── <nome-modulo>.service.spec.ts
   ```

3. **Injeção de Dependências & Evitar Dependência Circular:**
   - Organize os módulos de forma hierárquica e limpa.
   - Só use `forwardRef(() => OutroModule)` quando houver dependência mútua estritamente inevitável.
   - Em caso de dependência circular persistente, refatore para um serviço intermediário ou use eventos/event-emitter.

---

## ✍️ Regras para DTOs (Validação Estrita)

- Sempre use decorators do `class-validator` e `class-transformer`.
- Para tipos opcionais no update, use `@IsOptional()` em conjunto com decorators de tipo.
- Para tipos aninhados, use `@ValidateNested()` e `@Type(() => SubDto)`.
- Use `@ApiProperty()` / Swagger decorators para manter a documentação da API atualizada.

```typescript
import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  price: number;

  @IsOptional()
  @IsString()
  description?: string;
}
```

---

## ⚠️ Tratamento de Erros e Exceções

- Utilize exceções nativas do NestJS (`NotFoundException`, `BadRequestException`, `ForbiddenException`, `ConflictException`, `UnauthorizedException`).
- Nunca deixe erros desconhecidos vazarem stack traces em produção.
- Use mensagens amigáveis em português quando se destinarem à exibição no cliente/front-end.
- Registre erros inesperados com o logger do NestJS (`Logger`).

```typescript
if (!item) {
  throw new NotFoundException(`Item com ID "${id}" não foi encontrado.`);
}
```

---

## 🧪 Testabilidade

- Todo Service novo deve ter testes unitários cobrindo o fluxo feliz e os principais cenários de erro (ex: entidade não encontrada, violação de regra de negócio).
- Mocks para o Prisma devem ser criados usando `createMock<PrismaService>()` ou objetos com `jest.fn()`.
