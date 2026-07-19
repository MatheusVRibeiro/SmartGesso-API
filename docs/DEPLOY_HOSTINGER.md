# Deploy na Hostinger sem Docker

Este projeto não exige Docker em produção. Para usar a Hostinger, trate o MySQL como um serviço externo e configure a API com `DATABASE_URL` apontando para o banco criado no painel da hospedagem.

## Banco MySQL

1. Crie um banco MySQL no painel da Hostinger.
2. Crie um usuário com senha forte e permissões somente no banco do SmartGesso.
3. Configure charset/collation como `utf8mb4`/`utf8mb4_unicode_ci` quando disponível.
4. Guarde o host, porta, nome do banco, usuário e senha.
5. Monte a variável:

```env
DATABASE_URL=mysql://USUARIO:SENHA@HOST:3306/NOME_DO_BANCO
```

> Não versionar `.env` nem credenciais reais.

## Deploy da API

Fluxo recomendado:

```bash
npm ci
npm run db:generate
npm run db:migrate:deploy
npm run build
npm run start:prod
```

## Observações

- `db:up`, `db:down` e `db:logs` não sobem container; apenas informam que o banco é externo.
- Migrations devem ser aplicadas com `npm run db:migrate:deploy` no ambiente de produção.
- O aplicativo mobile e o painel admin nunca devem acessar o MySQL diretamente; ambos acessam somente a API.
