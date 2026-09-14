---
name: codebase-health-check
description: Checklist e rotina de validação pré-finalização para garantir compilação TypeScript limpa, ausência de erros de linter, passagem em testes automatizados e segurança de credenciais.
---

# Codebase Health Check Skill

Esta skill descreve o protocolo obrigatório de verificação de integridade que deve ser executado **sempre** antes de dar qualquer tarefa por concluída ou gerar commits.

---

## 🚦 Protocolo de Execução Pré-Finalização

O agente deve seguir estes 5 passos sequenciais:

### 1. Verificação de Tipos (Typecheck)
Garante que não há violações de tipagem estrita no TypeScript.
```bash
npm run build
```
*(ou `npx tsc --noEmit` para validação rápida de tipos sem emitir arquivos).*

### 2. Análise Estática e Estilo (Lint)
Garante que as convenções de código, imports não utilizados e regras do ESLint/Prettier foram respeitadas.
```bash
npm run lint
```
Se houver problemas menores de formatação, rode:
```bash
npm run format
```

### 3. Testes Automatizados (Unit & Integration)
Valida que as alterações não causaram regressões em módulos existentes.
```bash
npm test
```
*Se você alterou um módulo específico (ex: `service-orders`), pode rodar os testes daquele módulo primeiro durante a iteração: `npm test -- service-orders`.*

### 4. Auditoria de Segredos e Arquivos Temporários
- Verifique se nenhum segredo, chave de API, senha de banco de dados ou token real foi adicionado ao código ou commitado em arquivos de configuração.
- Certifique-se de que variáveis sensíveis continuam referenciando `process.env` e documentadas no `.env.example`.
- Remova `console.log` de debug temporários ou rascunhos desnecessários.

### 5. Revisão do Diff (`git status` e `git diff`)
- Revise as alterações feitas para garantir que apenas os arquivos necessários para a tarefa foram modificados.
- Verifique se comentários e documentações adjacentes foram preservados.

---

## 🛑 Critério de Parada (Gatekeeper)

Se qualquer um dos comandos (`lint`, `build` ou `test`) falhar:
1. **NÃO** considere a tarefa finalizada.
2. Analise a mensagem de erro exata.
3. Aplique a correção necessária.
4. Re-execute o pipeline de verificação até que todos os checks passem com status 0 (sucesso).
