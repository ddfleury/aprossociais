# Publicação em produção

## 1. Preparar o servidor

Use Node.js 22 LTS, HTTPS e MySQL 8.0.16+ ou MariaDB 10.6+. Crie um usuário Linux sem privilégios para o serviço. Não execute a aplicação como `root`.

```bash
node --version
npm --version
```

## 2. Banco

Importe o instalador em um banco vazio:

```bash
mysql --default-character-set=utf8mb4 \
  -h DB_HOST -u USUARIO_MIGRACAO -p NOME_BANCO \
  < database/INSTALAR_BANCO_COMPLETO.sql
```

O instalador contém gatilhos; no phpMyAdmin, importe o arquivo inteiro em vez de executar somente a instrução `CREATE TABLE matriculas_transferencias` isoladamente.

Se o banco anterior com as migrações 001 a 006 já estiver criado, não reimporte
o instalador completo: aplique somente
`database/migrations/007_certificados_snapshots.sql` e execute `npm run db:check`.

## 3. Aplicação

```bash
npm ci
cp .env.example .env
chmod 600 .env
mkdir -p storage/private
chmod 700 storage/private
npm run validate
npm run db:check
```

Preencha `APP_BASE_URL` com a URL HTTPS final e `SERVER_ACTION_ALLOWED_ORIGINS` com os hosts permitidos, separados por vírgula.

## 4. Primeiro administrador

Crie-o uma única vez conforme o README. Não deixe `ADMIN_PASSWORD` gravado em `.env`, script de deploy ou histórico do shell.

## 5. Processo

Com PM2:

```bash
npm install --global pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Ou use o gerenciador de processos oferecido pela hospedagem com:

```text
Comando de build: npm ci && npm run build
Comando inicial: npm start
Porta: 3000
```

## 6. Proxy reverso

Exemplo Nginx, ajustando domínio e porta:

```nginx
server {
    listen 443 ssl http2;
    server_name sistema.exemplo.org;

    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Ative `TRUST_PROXY=true` somente se este proxy for controlado e limpar cabeçalhos recebidos do cliente.

## 7. Cron

Exemplo a cada minuto:

```cron
* * * * * cd /caminho/apros-next && /usr/bin/npm run worker:messages >> /var/log/apros-worker.log 2>&1
```

Use bloqueio externo (`flock`) se o agendador puder iniciar duas execuções locais simultâneas. O banco também usa bloqueio por linha para concorrência segura.

## 8. Atualização

```bash
npm ci
npm run validate
pm2 reload apros-next
```

Antes de uma migração futura, faça backup e aplique os arquivos novos em ordem. Código e banco devem ser implantados de forma compatível.

## 9. Verificação pós-publicação

- `/api/health` responde `200`;
- login do administrador funciona por HTTPS;
- cookies aparecem como `Secure` e `HttpOnly`;
- página de outra unidade é recusada para usuário limitado;
- upload e download funcionam após reiniciar o processo;
- certificado abre e o QR Code valida;
- cron processa uma mensagem controlada;
- restauração de backup foi ensaiada.
