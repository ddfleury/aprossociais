# Segurança e privacidade

## Controles implementados

- validação Zod das entradas críticas;
- SQL parametrizado e `multipleStatements: false`;
- sessões opacas, `HttpOnly`, `SameSite=Strict` e `Secure` em produção;
- limitação e bloqueio de tentativas de login;
- senha Argon2id e mínimo de 14 caracteres para criação inicial e alteração própria;
- RBAC revalidado no servidor e filtragem por unidade;
- cabeçalhos CSP, anti-frame, `nosniff`, política de referência e permissões;
- criptografia autenticada AES-256-GCM e HMAC com chaves separadas;
- uploads por MIME detectado, tamanho, hash e nome gerado;
- documentos fora da raiz pública;
- erros públicos genéricos com protocolo rastreável;
- auditoria sem segredos e histórico sem exclusão destrutiva;
- fila de comunicação com consentimento explícito, versionado e revogável, bloqueios, idempotência e limite de tentativas.

## Segredos

Nunca envie `.env`, dump de produção, documentos ou chaves ao repositório. Em produção:

```bash
chmod 600 .env
chmod 700 storage/private
```

Mantenha backup seguro das chaves. Perder `DATA_ENCRYPTION_KEY_BASE64` torna os dados cifrados irrecuperáveis. Trocar a chave sem migração torna o conteúdo antigo ilegível.

## Banco

- use uma conta própria para a aplicação;
- nunca conecte como `root`;
- limite a conexão ao host da aplicação;
- habilite TLS quando o provedor oferecer certificado verificável;
- restrinja phpMyAdmin por rede, autenticação adicional ou VPN;
- mantenha MySQL/MariaDB e phpMyAdmin atualizados;
- faça backup cifrado e teste a restauração.

Em uma instalação com administração avançada de privilégios, dê à conta web somente `SELECT`, `INSERT`, `UPDATE` e `DELETE` nas tabelas operacionais. A conta não precisa de `CREATE`, `ALTER`, `DROP`, `TRIGGER`, `FILE` ou `GRANT OPTION` durante o uso normal. As migrações devem usar uma credencial separada e temporária.

## Proxy e HTTPS

Defina `TRUST_PROXY=true` apenas quando a aplicação estiver atrás de proxy controlado que sobrescreve `X-Forwarded-For`. Caso contrário, um cliente poderia forjar o IP auditado. Habilite HSTS no proxy somente depois de confirmar HTTPS em todo o domínio.

## Proteção de dados

Antes de produção, defina:

- base legal e finalidade de cada coleta;
- perfis autorizados a dados sensíveis;
- política de retenção e anonimização;
- rotina de correção cadastral;
- resposta a incidentes;
- responsável por revisar auditoria e revogações;
- procedimento de exportação/atendimento ao titular.

Evite colocar dados pessoais em logs, URLs, nomes de arquivos, mensagens de erro ou metadados de auditoria.

## Checklist de homologação

- [ ] usuário sem permissão recebe bloqueio mesmo chamando a URL diretamente;
- [ ] coordenador de uma unidade não acessa outra unidade;
- [ ] documentos não abrem por URL em `public/`;
- [ ] arquivo falso com extensão PDF é recusado;
- [ ] CPF e telefone não aparecem em texto puro no banco;
- [ ] logout e alteração de senha revogam sessões esperadas;
- [ ] certificado revogado aparece como revogado na validação pública;
- [ ] cron sem `Bearer` correto recebe `401`;
- [ ] mensagens duplicadas não são recriadas na mesma fila;
- [ ] participante sem consentimento ativo permanece bloqueado para WhatsApp;
- [ ] revogar a autorização impede novas filas sem apagar a evidência anterior;
- [ ] backup completo pode ser restaurado em ambiente isolado.

## Limites conhecidos

A CSP usa `unsafe-inline` para scripts/estilos necessários ao runtime e a estilos dinâmicos da interface. Para um ambiente de risco elevado, evolua para nonces por requisição conforme o padrão suportado pelo Next.js. Integrações WhatsApp devem validar também os requisitos do provedor e os modelos aprovados quando aplicável.
