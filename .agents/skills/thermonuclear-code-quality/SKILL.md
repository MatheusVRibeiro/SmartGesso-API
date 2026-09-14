---
name: thermonuclear-code-quality
description: Padrão inflexível de qualidade de código, eliminação de débitos técnicos, tipagem estrita sem 'any', prevenção de efeitos colaterais e excelência arquitetural em TypeScript e NestJS.
---

# Thermonuclear Code Quality Skill

Esta skill impõe um padrão rigoroso e intransigente de excelência em engenharia de software. O objetivo é tolerância zero para código frágil, débitos técnicos acumulados, tipos soltos e soluções improvisadas.

---

## ⚡ Princípios Não-Negociáveis

### 1. Tipagem Estrita e Completa (Banimento do `any`)
- **Proibido usar `any`:** Substitua por interfaces explícitas, tipos discriminados, genéricos ou `unknown` acompanhado de type narrowing (type guards).
- **Sem `as unknown as Type` (Type casting forçado):** O uso de asserções duplas de tipo é sinal de modelagem incorreta. Corrija o tipo na origem ou utilize validações de schema/DTO.
- **Tipos de Retorno Explícitos:** Toda função de Service, Controller e utilitário deve declarar seu tipo de retorno (`Promise<QuoteResponseDto>`, `Promise<void>`, etc.).

### 2. Tratamento de Exceções Sem Engolir Erros
- **Nunca use blocos `catch` vazios:** Capturar um erro sem tratá-lo ou registrá-lo no Logger é inaceitável.
- **Não mascare a causa-raiz:** Ao relançar exceções, encadeie ou registre a causa original (`new InternalServerErrorException(..., { cause: error })`).
- **Falha Rápida (Fail-Fast):** Valide pré-condições, argumentos e estados logo no início de funções e métodos antes de iniciar processamentos custosos.

### 3. Eliminação de Código Morto e Rascunhos
- Nada de blocos de código comentados deixados para trás ("talvez usemos depois").
- Sem imports ou variáveis declaradas e não utilizadas.
- Sem `console.log` de depuração temporária perdidos no código (use sempre o logger da aplicação ou remova antes do commit).

### 4. Responsabilidade Única e Métodos Pequenos (SOLID)
- Funções com mais de 40-50 linhas frequentemente fazem coisas demais. Quebre em funções privadas auxiliares puras ou serviços especializados.
- Separe completamente queries e persistência de dados da lógica de formatação e apresentação.

### 5. Imutabilidade e Prevenção de Efeitos Colaterais
- Prefira `readonly` em propriedades de DTOs e classes utilitárias.
- Evite mutação de objetos ou arrays passados por parâmetro. Use spread operator (`...`), métodos imutáveis (`map`, `filter`, `reduce`) ou cópias estruturadas.

---

## 📋 Checklist Termonuclear de Code Review

Antes de submeter ou aprovar qualquer alteração:

- [ ] **Zero `any`:** Há algum `any`, `ts-ignore` ou casting perigoso?
- [ ] **Complexidade Ciclomática:** O código possui aninhamentos profundos de `if`/`else` que poderiam ser simplificados com *guard clauses* (early returns)?
- [ ] **Nomenclatura Clara:** Variáveis e funções têm nomes autoexplicativos que revelam intenção sem abreviações crípticas?
- [ ] **Dry & Duplicação:** Existe lógica repetida em mais de um lugar que deveria ser extraída para um utilitário ou serviço compartilhado?
- [ ] **Efeitos Colaterais:** A função altera estado global, parâmetros recebidos ou realiza mutações imprevisíveis?
- [ ] **Cobertura de Casos de Borda:** O que acontece se o valor for `null`, `undefined`, string vazia, array vazio ou número negativo?
- [ ] **Build & Linter Limpos:** O comando `npm run build` e `npm run lint` rodam com zero advertências e zero erros?
