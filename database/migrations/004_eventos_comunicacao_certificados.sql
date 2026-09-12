-- ============================================================================
-- NOVO PROJETO APROS - MIGRACAO 004
-- Eventos, fila de comunicacao, certificados e verificacao cadastral
-- Requer: migracoes 001, 002 e 003
-- ============================================================================

SET time_zone = '+00:00';
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

CREATE TABLE IF NOT EXISTS eventos (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    programa_unidade_id BIGINT UNSIGNED NOT NULL,
    tipo                VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    titulo              VARCHAR(180) NOT NULL,
    descricao           TEXT NULL,
    inicio_em           DATETIME(6) NOT NULL,
    fim_em              DATETIME(6) NOT NULL,
    local_nome          VARCHAR(180) NULL,
    endereco_cifrado    VARBINARY(1024) NULL,
    capacidade          INT UNSIGNED NULL,
    status              VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PLANEJADO',
    criado_por          BIGINT UNSIGNED NOT NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    cancelado_em        DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_eventos_public_id (public_id),
    KEY idx_eventos_unidade_periodo (programa_unidade_id, inicio_em, status),
    KEY idx_eventos_periodo (inicio_em, fim_em),
    KEY idx_eventos_criador (criado_por),
    CONSTRAINT fk_eventos_prog_unid FOREIGN KEY (programa_unidade_id)
        REFERENCES programas_unidades (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_eventos_criador FOREIGN KEY (criado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_eventos_tipo CHECK (tipo IN ('PASSEIO', 'FORMATURA', 'REUNIAO', 'CAMPANHA', 'OUTRO')),
    CONSTRAINT ck_eventos_status CHECK (status IN ('PLANEJADO', 'ABERTO', 'CONCLUIDO', 'CANCELADO')),
    CONSTRAINT ck_eventos_periodo CHECK (fim_em > inicio_em),
    CONSTRAINT ck_eventos_capacidade CHECK (capacidade IS NULL OR capacidade > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS eventos_participantes (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    evento_id           BIGINT UNSIGNED NOT NULL,
    matricula_id        BIGINT UNSIGNED NOT NULL,
    status              VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'INSCRITO',
    confirmado_em       DATETIME(6) NULL,
    compareceu          TINYINT(1) NULL,
    observacao_cifrada  LONGBLOB NULL,
    registrado_por      BIGINT UNSIGNED NOT NULL,
    registrado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_evento_matricula (evento_id, matricula_id),
    KEY idx_evento_part_matricula (matricula_id, evento_id),
    KEY idx_evento_part_status (evento_id, status),
    KEY idx_evento_part_registrador (registrado_por),
    CONSTRAINT fk_evento_part_evento FOREIGN KEY (evento_id)
        REFERENCES eventos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_evento_part_matricula FOREIGN KEY (matricula_id)
        REFERENCES matriculas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_evento_part_usuario FOREIGN KEY (registrado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_evento_part_status CHECK (status IN ('INSCRITO', 'CONFIRMADO', 'CANCELADO', 'LISTA_ESPERA')),
    CONSTRAINT ck_evento_part_presenca CHECK (compareceu IS NULL OR compareceu IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comunicacoes_modelos (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    codigo              VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nome                VARCHAR(150) NOT NULL,
    canal               VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    assunto_modelo      VARCHAR(180) NULL,
    corpo_modelo        TEXT NOT NULL COMMENT 'Variaveis devem usar lista permitida pela aplicacao',
    versao              INT UNSIGNED NOT NULL DEFAULT 1,
    ativo               TINYINT(1) NOT NULL DEFAULT 1,
    criado_por          BIGINT UNSIGNED NOT NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_com_modelos_public_id (public_id),
    UNIQUE KEY uq_com_modelos_codigo_ver (codigo, versao),
    KEY idx_com_modelos_lista (canal, ativo, nome),
    KEY idx_com_modelos_criador (criado_por),
    CONSTRAINT fk_com_modelos_criador FOREIGN KEY (criado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_com_modelos_canal CHECK (canal IN ('WHATSAPP', 'EMAIL', 'SMS', 'INTERNO')),
    CONSTRAINT ck_com_modelos_versao CHECK (versao > 0),
    CONSTRAINT ck_com_modelos_ativo CHECK (ativo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comunicacoes_filas (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    modelo_id           BIGINT UNSIGNED NULL,
    programa_id         BIGINT UNSIGNED NULL,
    unidade_id          BIGINT UNSIGNED NULL,
    canal               VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    titulo              VARCHAR(180) NOT NULL,
    mensagem_cifrada    LONGBLOB NOT NULL COMMENT 'Conteudo cifrado se contiver dado pessoal',
    agendada_para       DATETIME(6) NULL,
    status              VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'RASCUNHO',
    criado_por          BIGINT UNSIGNED NOT NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    iniciado_em         DATETIME(6) NULL,
    concluido_em        DATETIME(6) NULL,
    cancelado_em        DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_com_filas_public_id (public_id),
    KEY idx_com_filas_processamento (status, agendada_para, criado_em),
    KEY idx_com_filas_programa (programa_id, criado_em),
    KEY idx_com_filas_unidade (unidade_id, criado_em),
    KEY idx_com_filas_modelo (modelo_id),
    KEY idx_com_filas_criador (criado_por),
    CONSTRAINT fk_com_filas_modelo FOREIGN KEY (modelo_id)
        REFERENCES comunicacoes_modelos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_com_filas_programa FOREIGN KEY (programa_id)
        REFERENCES programas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_com_filas_unidade FOREIGN KEY (unidade_id)
        REFERENCES unidades (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_com_filas_criador FOREIGN KEY (criado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_com_filas_canal CHECK (canal IN ('WHATSAPP', 'EMAIL', 'SMS', 'INTERNO')),
    CONSTRAINT ck_com_filas_status CHECK (status IN ('RASCUNHO', 'AGENDADA', 'PROCESSANDO', 'CONCLUIDA', 'CANCELADA'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada destinatario possui chave de idempotencia: uma repeticao de job nao
-- envia a mesma mensagem duas vezes.
CREATE TABLE IF NOT EXISTS comunicacoes_destinatarios (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    fila_id             BIGINT UNSIGNED NOT NULL,
    matricula_id        BIGINT UNSIGNED NULL,
    contato_id          BIGINT UNSIGNED NULL,
    idempotencia_chave  CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    destino_cifrado     VARBINARY(768) NOT NULL,
    destino_hash        BINARY(32) NOT NULL COMMENT 'HMAC do telefone/e-mail normalizado',
    destino_mascarado   VARCHAR(80) NOT NULL,
    nome_snapshot       VARCHAR(180) NULL,
    variaveis_cifradas  LONGBLOB NULL,
    status              VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDENTE',
    tentativas          SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    tentar_novamente_em DATETIME(6) NULL,
    bloqueado_em        DATETIME(6) NULL COMMENT 'Opt-out, ausencia de consentimento ou bloqueio administrativo',
    enviado_em          DATETIME(6) NULL,
    entregue_em         DATETIME(6) NULL,
    lido_em             DATETIME(6) NULL,
    falhou_em           DATETIME(6) NULL,
    erro_codigo         VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NULL,
    provedor            VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
    provedor_mensagem_id VARCHAR(190) CHARACTER SET ascii COLLATE ascii_bin NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_com_dest_public_id (public_id),
    UNIQUE KEY uq_com_dest_idempotencia (idempotencia_chave),
    KEY idx_com_dest_fila_destino (fila_id, destino_hash),
    KEY idx_com_dest_worker (status, tentar_novamente_em, id),
    KEY idx_com_dest_fila_status (fila_id, status),
    KEY idx_com_dest_matricula (matricula_id, criado_em),
    KEY idx_com_dest_contato (contato_id),
    KEY idx_com_dest_provedor (provedor, provedor_mensagem_id),
    CONSTRAINT fk_com_dest_fila FOREIGN KEY (fila_id)
        REFERENCES comunicacoes_filas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_com_dest_matricula FOREIGN KEY (matricula_id)
        REFERENCES matriculas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_com_dest_contato FOREIGN KEY (contato_id)
        REFERENCES pessoas_contatos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_com_dest_status CHECK (
        status IN ('PENDENTE', 'PROCESSANDO', 'ENVIADA', 'ENTREGUE', 'LIDA', 'FALHOU', 'CANCELADA', 'BLOQUEADA')
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comunicacoes_tentativas (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    destinatario_id     BIGINT UNSIGNED NOT NULL,
    numero_tentativa    SMALLINT UNSIGNED NOT NULL,
    iniciada_em         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    finalizada_em       DATETIME(6) NULL,
    sucesso             TINYINT(1) NOT NULL DEFAULT 0,
    http_status         SMALLINT UNSIGNED NULL,
    erro_codigo         VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NULL,
    resposta_cifrada    LONGBLOB NULL COMMENT 'Nao armazenar token ou cabecalho Authorization',
    PRIMARY KEY (id),
    UNIQUE KEY uq_com_tent_numero (destinatario_id, numero_tentativa),
    KEY idx_com_tent_data (iniciada_em),
    CONSTRAINT fk_com_tent_dest FOREIGN KEY (destinatario_id)
        REFERENCES comunicacoes_destinatarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_com_tent_numero CHECK (numero_tentativa > 0),
    CONSTRAINT ck_com_tent_sucesso CHECK (sucesso IN (0, 1)),
    CONSTRAINT ck_com_tent_http CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comunicacoes_bloqueios (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    canal               VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    destino_hash        BINARY(32) NOT NULL,
    programa_id         BIGINT UNSIGNED NULL COMMENT 'NULL significa bloqueio global',
    motivo              VARCHAR(200) NOT NULL,
    solicitado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    revogado_em         DATETIME(6) NULL,
    registrado_por      BIGINT UNSIGNED NULL,
    PRIMARY KEY (id),
    KEY idx_com_bloqueios_destino (canal, destino_hash, revogado_em),
    KEY idx_com_bloqueios_programa (programa_id, revogado_em),
    KEY idx_com_bloqueios_usuario (registrado_por),
    CONSTRAINT fk_com_bloqueios_programa FOREIGN KEY (programa_id)
        REFERENCES programas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_com_bloqueios_usuario FOREIGN KEY (registrado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_com_bloqueios_canal CHECK (canal IN ('WHATSAPP', 'EMAIL', 'SMS')),
    CONSTRAINT ck_com_bloqueios_revoga CHECK (revogado_em IS NULL OR revogado_em >= solicitado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS certificados (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Identificador publico aleatorio',
    matricula_id        BIGINT UNSIGNED NOT NULL,
    componente_id       BIGINT UNSIGNED NULL,
    titulo              VARCHAR(180) NOT NULL,
    modelo_versao       VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    carga_minutos       INT UNSIGNED NULL,
    emitido_em          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    arquivo_storage_key VARCHAR(500) CHARACTER SET ascii COLLATE ascii_bin NULL,
    arquivo_hash        BINARY(32) NULL,
    status              VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'VALIDO',
    revogado_em         DATETIME(6) NULL,
    motivo_revogacao    VARCHAR(500) NULL,
    emitido_por         BIGINT UNSIGNED NOT NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_certificados_public_id (public_id),
    UNIQUE KEY uq_certificados_storage (arquivo_storage_key),
    KEY idx_certificados_matricula (matricula_id, emitido_em),
    KEY idx_certificados_componente (componente_id, emitido_em),
    KEY idx_certificados_status (status, emitido_em),
    KEY idx_certificados_emissor (emitido_por),
    CONSTRAINT fk_certificados_matricula FOREIGN KEY (matricula_id)
        REFERENCES matriculas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_certificados_componente FOREIGN KEY (componente_id)
        REFERENCES componentes_curriculares (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_certificados_emissor FOREIGN KEY (emitido_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_certificados_status CHECK (status IN ('VALIDO', 'REVOGADO', 'SUBSTITUIDO')),
    CONSTRAINT ck_certificados_carga CHECK (carga_minutos IS NULL OR carga_minutos > 0),
    CONSTRAINT ck_certificados_revoga CHECK (
        status <> 'REVOGADO' OR (revogado_em IS NOT NULL AND motivo_revogacao IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Link temporario de uso unico. A URL recebe o token original; o banco recebe
-- apenas SHA-256(token), impedindo reutilizacao se o banco for exposto.
CREATE TABLE IF NOT EXISTS certificados_links (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    certificado_id      BIGINT UNSIGNED NOT NULL,
    token_hash          BINARY(32) NOT NULL,
    finalidade          VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    expira_em           DATETIME(6) NOT NULL,
    utilizado_em        DATETIME(6) NULL,
    criado_por          BIGINT UNSIGNED NULL,
    criado_ip           VARBINARY(16) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cert_links_token (token_hash),
    KEY idx_cert_links_certificado (certificado_id, finalidade, expira_em),
    KEY idx_cert_links_expira (expira_em, utilizado_em),
    KEY idx_cert_links_criador (criado_por),
    CONSTRAINT fk_cert_links_certificado FOREIGN KEY (certificado_id)
        REFERENCES certificados (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_cert_links_criador FOREIGN KEY (criado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_cert_links_finalidade CHECK (finalidade IN ('VISUALIZAR', 'BAIXAR', 'COMPARTILHAR')),
    CONSTRAINT ck_cert_links_expira CHECK (expira_em > criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS certificados_acessos (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    certificado_id      BIGINT UNSIGNED NOT NULL,
    link_id             BIGINT UNSIGNED NULL,
    usuario_id          BIGINT UNSIGNED NULL,
    resultado           VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    ip                  VARBINARY(16) NULL,
    user_agent          VARCHAR(500) NULL,
    ocorrido_em         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_cert_acessos_cert (certificado_id, ocorrido_em),
    KEY idx_cert_acessos_link (link_id),
    KEY idx_cert_acessos_usuario (usuario_id, ocorrido_em),
    CONSTRAINT fk_cert_acessos_cert FOREIGN KEY (certificado_id)
        REFERENCES certificados (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_cert_acessos_link FOREIGN KEY (link_id)
        REFERENCES certificados_links (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_cert_acessos_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_cert_acessos_resultado CHECK (resultado IN ('AUTORIZADO', 'NEGADO', 'EXPIRADO', 'JA_UTILIZADO'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Solicitacao publica para que a equipe confira divergencias. Os dados
-- informados ficam cifrados e nunca aprovam automaticamente o certificado.
CREATE TABLE IF NOT EXISTS verificacoes_cadastrais (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    protocolo           VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    participante_id     BIGINT UNSIGNED NULL,
    certificado_id      BIGINT UNSIGNED NULL,
    dados_informados_cifrados LONGBLOB NOT NULL,
    contato_retorno_cifrado VARBINARY(768) NOT NULL,
    contato_retorno_hash BINARY(32) NOT NULL,
    contato_retorno_mascarado VARCHAR(80) NOT NULL,
    status              VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDENTE',
    solicitado_ip       VARBINARY(16) NULL,
    solicitado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    analisado_por       BIGINT UNSIGNED NULL,
    analisado_em        DATETIME(6) NULL,
    parecer_cifrado     LONGBLOB NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_verificacoes_public_id (public_id),
    UNIQUE KEY uq_verificacoes_protocolo (protocolo),
    KEY idx_verificacoes_fila (status, solicitado_em),
    KEY idx_verificacoes_participante (participante_id, solicitado_em),
    KEY idx_verificacoes_certificado (certificado_id),
    KEY idx_verificacoes_contato (contato_retorno_hash, solicitado_em),
    KEY idx_verificacoes_analista (analisado_por),
    CONSTRAINT fk_verificacoes_participante FOREIGN KEY (participante_id)
        REFERENCES participantes (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_verificacoes_certificado FOREIGN KEY (certificado_id)
        REFERENCES certificados (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_verificacoes_analista FOREIGN KEY (analisado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_verificacoes_status CHECK (status IN ('PENDENTE', 'EM_ANALISE', 'APROVADA', 'RECUSADA', 'CANCELADA'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
