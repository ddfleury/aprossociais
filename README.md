# APROS Sociais — aplicação Next.js

Aplicação institucional para cadastro, matrícula, transferência, acompanhamento pedagógico, eventos, documentos, certificados e comunicação com responsáveis. O projeto usa o banco normalizado entregue em `database/` e foi estruturado para operar com dados pessoais e diferentes níveis de acesso.

## Funcionalidades entregues

- autenticação com sessão opaca, cookie `HttpOnly`, expiração e bloqueio por tentativas;
- autorização RBAC global ou limitada por unidade;
- painel com indicadores operacionais reais;
- participantes, responsáveis, matrícula inicial, edição e histórico;
- consulta de matrículas e movimentação entre unidades com solicitação, aprovação e efetivação transacional;
- planos de aula, encontros, chamada e fechamento de frequência;
- eventos, seleção de participantes e lista de impressão com assinatura;
- documentos privados com validação do conteúdo real, hash e trilha de acesso;
- certificados PDF profissionais, QR Code, validação pública mínima e revogação;
- mensagens WhatsApp com seleção de destinatários, consentimento explícito e revogável, fila, idempotência, retentativas e processamento assíncrono;
- relatórios por gênero, idade, unidade e programa, com relação nominal ao clicar no indicador e impressão configurável por coluna;
- administração de unidades, programas, turmas, atividades, usuários e papéis;
- área “Minha conta” para perfil, senha e revogação de outras sessões;
- auditoria append-only e endpoint de saúde.

## Requisitos

- Node.js 22 LTS (o mínimo aceito pelo Next.js 16 é Node 20.9);
- MySQL 8.0.16+ ou MariaDB 10.6+;
- HTTPS em produção;
- usuário de banco exclusivo da aplicação;
- diretório privado persistente e gravável para os documentos.

## Instalação rápida

1. Crie um banco vazio com `utf8mb4`.
2. Importe `database/INSTALAR_BANCO_COMPLETO.sql` pelo cliente MySQL ou phpMyAdmin.
   Se as migrações 001 a 006 já estiverem instaladas, aplique somente
   `database/migrations/007_certificados_snapshots.sql` antes de iniciar a aplicação.
3. Instale as dependências:

   ```bash
   npm ci
   ```

4. Crie o arquivo local de configuração:

   ```bash
   cp .env.example .env
   ```

5. Gere chaves diferentes e preencha o `.env`:

   ```bash
   openssl rand -base64 32
   openssl rand -base64 32
   openssl rand -base64 32
   openssl rand -hex 32
   ```

   Use os três primeiros resultados, respectivamente, em `DATA_ENCRYPTION_KEY_BASE64`, `DATA_HMAC_KEY_BASE64` e `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`. Use o último em `CRON_SECRET`.

6. Confirme a estrutura do banco:

   ```bash
   npm run db:check
   ```

7. Crie o primeiro administrador. Não existe senha padrão:

   ```bash
   export ADMIN_NAME="Administrador APROS"
   export ADMIN_LOGIN="administrador"
   export ADMIN_EMAIL="administrador@exemplo.org"
   read -rsp "Senha inicial: " ADMIN_PASSWORD && export ADMIN_PASSWORD
   npm run admin:create
   unset ADMIN_PASSWORD
   ```

8. Inicie em desenvolvimento:

   ```bash
   npm run dev
   ```

   Acesse `http://localhost:3000`.

## Comandos

| Comando                   | Finalidade                                     |
| ------------------------- | ---------------------------------------------- |
| `npm run dev`             | servidor de desenvolvimento                    |
| `npm run build`           | compilação otimizada de produção               |
| `npm start`               | inicia a versão compilada                      |
| `npm run validate`        | lint, tipos, testes e build                    |
| `npm run db:check`        | confirma servidor e tabelas essenciais         |
| `npm run admin:create`    | cria o primeiro administrador sem senha padrão |
| `npm run worker:messages` | processa até 100 destinatários da fila         |
| `npm run test:coverage`   | testes com relatório de cobertura              |

## WhatsApp e fila

O consentimento para WhatsApp não vem pré-marcado. No cadastro, o operador deve
confirmar a manifestação expressa do responsável. A versão do termo, a decisão,
o responsável, o operador, a data e a evidência por hash ficam registrados. Ao
desmarcar a autorização na edição do participante, o consentimento anterior é
revogado sem apagar o histórico e novas filas passam a bloquear o contato.

Sem as variáveis `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID`, a aplicação permite preparar a fila, mas não envia mensagens. Isso evita simular sucesso quando o provedor não está configurado.

Para processamento por cron, execute a cada minuto uma destas opções:

```bash
npm run worker:messages
```

ou:

```bash
curl --fail --silent --show-error \
  --request POST \
  -H "Authorization: Bearer SEU_CRON_SECRET" \
  https://seu-dominio.example/api/cron/comunicacoes
```

O worker bloqueia registros com `FOR UPDATE SKIP LOCKED`, usa chave de idempotência por destinatário e aplica retentativas com espera crescente. A API externa deve aceitar o formato documentado em `docs/OPERACAO.md`.

## Estrutura do projeto

```text
src/app/                 rotas, layouts e endpoints HTTP
src/components/          componentes visuais compartilhados
src/core/                autenticação, banco, criptografia e segurança
src/modules/             regras e consultas de cada domínio
scripts/                 administrador inicial, checagem e worker
database/                instalador completo e migrações numeradas
storage/private/         arquivos privados; nunca publicar na web
docs/                    arquitetura, segurança, operação e deploy
```

## Decisões de segurança

- SQL parametrizado com `mysql2.execute()`; nenhuma entrada é interpolada nas consultas.
- CPF e contatos são cifrados com AES-256-GCM; buscas usam HMAC-SHA-256 com chave separada.
- Senhas usam Argon2id com custo de memória explícito.
- Documentos ficam fora de `public/` e são baixados por endpoint autenticado, autorizado e auditado.
- Consultas operacionais aplicam o escopo de unidade no servidor.
- Server Actions validam novamente permissão e pertencimento; a interface não é barreira de segurança.
- Erros públicos recebem protocolo sem detalhes internos do banco.
- Certificados expõem publicamente somente os dados mínimos de validação.
- Auditoria omite chaves com senha, token, CPF, saúde, endereço, telefone, e-mail ou segredo.

Leia também:

- [Arquitetura](docs/ARQUITETURA.md)
- [Segurança](docs/SEGURANCA.md)
- [Operação](docs/OPERACAO.md)
- [Publicação](docs/DEPLOY.md)

## Antes de produção

Execute:

```bash
npm ci
npm run validate
npm run db:check
```

Faça ainda um teste integrado em homologação com banco MySQL real: login, cadastro, transferência, chamada, upload/download, certificado e uma mensagem para número controlado. O build e os testes automatizados não substituem a validação das credenciais, permissões, armazenamento e provedor do ambiente final.
# aprossociais
