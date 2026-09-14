---
name: systematic-debugging
description: Metodologia científica e estruturada de diagnóstico, isolamento, reprodução e resolução de bugs, eliminando tentativas aleatórias de correção.
---

# Systematic Debugging Skill

Esta skill descreve o processo determinístico e científico para investigar e solucionar bugs na aplicação, substituindo alterações às cegas (*shotgun debugging*) por diagnóstico preciso da causa-raiz.

---

## 🔬 O Ciclo Científico de Depuração

```
[1. Coleta de Evidências] ➔ [2. Reprodução Mínima] ➔ [3. Isolamento da Causa-Raiz] ➔ [4. Correção Cirúrgica] ➔ [5. Teste de Regressão]
```

---

### Fase 1: Coleta de Evidências (Observar sem Suposições)
- Obtenha a mensagem de erro exata e o stack trace completo.
- Identifique os parâmetros de entrada (`payload`, `headers`, `params`, `query`) que dispararam a falha.
- Verifique o estado do banco de dados no momento da falha (registros ausentes, colunas nulas, foreign keys quebradas).
- **Regra:** Nunca inicie uma alteração no código antes de compreender exatamente onde e por que a falha aconteceu.

### Fase 2: Reprodução Mínima e Determinística
- Reproduza a falha localmente por meio de um teste unitário ou de integração com Jest (`*.spec.ts`).
- Se não for viável via teste imediato, isole a chamada exata no controller/service com os dados mínimos que provocam o erro.
- Se o bug não puder ser reproduzido confiavelmente, a investigação deve focar em logs e métricas adicionais antes de mudar o código.

### Fase 3: Isolamento da Causa-Raiz (Os "5 Porquês")
- Faça a distinção clara entre o **sintoma** (ex: `Cannot read properties of undefined`) e a **causa-raiz** (ex: a consulta no Prisma retornou `null` porque o filtro `companyId` não bateu com a empresa associada ao registro).
- Inspecione a cadeia de execução de trás para frente a partir do ponto onde a exceção estourou.
- Pergunte-se: "Esta falha ocorre apenas com este registro ou em qualquer fluxo análogo?".

### Fase 4: Correção Cirúrgica
- Aplique a alteração necessária diretamente na causa-raiz, modificando o menor número de linhas possível.
- Evite mudanças secundárias não relacionadas que dificultem a leitura do diff ou introduzam novos efeitos colaterais.
- Trate o caso de borda de forma elegante (ex: validação prévia, lançamento de exceção HTTP apropriada com mensagem clara, ou fallback seguro).

### Fase 5: Prevenção de Regressão
- Converta o cenário de teste reproduzido na Fase 2 em um teste automatizado permanente na suíte Jest.
- Execute a suíte de testes completa do módulo:
  ```bash
  npm test
  ```
- Garanta que a correção não quebrou nenhum outro teste existente.

---

## 🚫 Armadilhas a Evitar
- **Shotgun Debugging:** Fazer várias alterações simultâneas esperando que uma delas funcione por sorte.
- **Tratar apenas o sintoma:** Adicionar `optional chaining` (`obj?.prop`) sem entender por que `obj` está indefinido quando deveria existir.
- **Engolir o erro:** Colocar um `try/catch` silencioso ao redor do trecho com falha apenas para não quebrar a aplicação.
