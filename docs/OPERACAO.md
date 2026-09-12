# Operação

## Rotina diária

- acompanhe filas em `Comunicações`;
- verifique transferências solicitadas;
- revise documentos vencidos ou revogados;
- acompanhe eventos e encontros em aberto;
- consulte a auditoria quando houver divergência;
- confirme que `/api/health` retorna HTTP 200.

## Estados da transferência

| Estado       | Significado            | Próxima ação              |
| ------------ | ---------------------- | ------------------------- |
| `SOLICITADA` | aguardando análise     | aprovar ou recusar        |
| `APROVADA`   | destino autorizado     | efetivar                  |
| `RECUSADA`   | análise desfavorável   | consultar justificativa   |
| `EFETIVADA`  | vínculo atual alterado | nenhuma                   |
| `CANCELADA`  | solicitação cancelada  | criar nova, se necessário |

Somente a efetivação movimenta a matrícula. Aprovar não altera a unidade atual.

## Fila de WhatsApp

Somente participantes com consentimento ativo aparecem como elegíveis. A caixa
de autorização do cadastro nunca vem marcada. Se o responsável retirar a
autorização, desmarque-a em `Participantes > Editar`; a alteração preserva a
evidência anterior e bloqueia o contato para novas filas.

O adaptador envia `POST` para `WHATSAPP_API_URL` com:

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5561999999999",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "Mensagem renderizada"
  }
}
```

Cabeçalho:

```text
Authorization: Bearer WHATSAPP_API_TOKEN
```

Se o seu provedor usar outro contrato, ajuste apenas `sendWhatsApp()` em `src/modules/communications/processor.ts`. Não exponha o token ao navegador.

As variáveis aceitas no texto são `{{nome}}` e `{{matricula}}`. Depois de cinco falhas, o destinatário deixa de ser reagendado automaticamente e exige revisão humana.

## Backups

O backup precisa combinar:

1. dump consistente do banco;
2. conteúdo de `PRIVATE_STORAGE_PATH`;
3. cópia segura das chaves de criptografia e HMAC;
4. versão do código implantada.

Banco e arquivos devem pertencer à mesma janela de backup. Teste restauração periodicamente em ambiente sem acesso público.

## Diagnóstico

| Sintoma                | Verificação                                                   |
| ---------------------- | ------------------------------------------------------------- |
| HTTP 500 após publicar | logs do processo, `.env`, versão do Node e `npm run db:check` |
| login sempre falha     | usuário ativo, hora UTC do banco e cookie HTTPS               |
| tela sem registros     | papel/permissão e escopo de unidade                           |
| upload falha           | permissão do diretório, limite, MIME real e espaço em disco   |
| fila não envia         | três variáveis WhatsApp, cron e histórico de tentativas       |
| PDF não abre           | permissão do certificado e arquivo/hash registrado            |

Erros operacionais exibem um UUID de protocolo. Procure o mesmo `request_id` em `auditoria_eventos` ou nos logs do processo, sem mostrar os detalhes técnicos ao usuário final.

## Limpeza controlada

- inative usuários e participantes; não apague histórico para “corrigir” um cadastro;
- revogue documentos e certificados, preservando o motivo;
- use política formal para expurgo/anonimização;
- não remova arquivos privados manualmente sem atualizar o registro correspondente em transação operacional aprovada.
