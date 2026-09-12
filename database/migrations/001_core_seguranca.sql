-- ============================================================================
-- NOVO PROJETO APROS - MIGRACAO 001
-- Nucleo institucional, pessoas, autenticacao, autorizacao e auditoria
-- Compatibilidade: MySQL 8.0.16+ e MariaDB 10.6+ (InnoDB)
-- ============================================================================

-- Execute todas as conexoes da aplicacao em UTC.
SET time_zone = '+00:00';
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- Controle das migracoes aplicadas. A aplicacao deve registrar cada arquivo
-- somente depois de sua execucao bem-sucedida.
CREATE TABLE IF NOT EXISTS schema_migrations (
    versao              VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    checksum_sha256     CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    aplicado_em         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (versao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS programas (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'UUID gerado pela aplicacao',
    codigo              VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nome                VARCHAR(150) NOT NULL,
    descricao           TEXT NULL,
    idade_minima        TINYINT UNSIGNED NULL,
    idade_maxima        TINYINT UNSIGNED NULL,
    ativo               TINYINT(1) NOT NULL DEFAULT 1,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    excluido_em         DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_programas_public_id (public_id),
    UNIQUE KEY uq_programas_codigo (codigo),
    KEY idx_programas_ativo_nome (ativo, nome),
    CONSTRAINT ck_programas_idade CHECK (
        idade_minima IS NULL OR idade_maxima IS NULL OR idade_minima <= idade_maxima
    ),
    CONSTRAINT ck_programas_ativo CHECK (ativo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS unidades (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'UUID gerado pela aplicacao',
    codigo              VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nome                VARCHAR(180) NOT NULL,
    sigla               VARCHAR(30) NULL,
    tipo                VARCHAR(30) NOT NULL DEFAULT 'UNIDADE',
    logradouro          VARCHAR(180) NULL,
    numero              VARCHAR(30) NULL,
    complemento         VARCHAR(100) NULL,
    bairro              VARCHAR(100) NULL,
    cidade              VARCHAR(100) NULL,
    uf                  CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NULL,
    cep                 CHAR(8) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT 'Somente digitos',
    telefone            VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT 'Formato E.164, quando possivel',
    ativo               TINYINT(1) NOT NULL DEFAULT 1,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    excluido_em         DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_unidades_public_id (public_id),
    UNIQUE KEY uq_unidades_codigo (codigo),
    KEY idx_unidades_ativo_nome (ativo, nome),
    KEY idx_unidades_cidade_uf (cidade, uf),
    CONSTRAINT ck_unidades_uf CHECK (uf IS NULL OR uf REGEXP '^[A-Z]{2}$'),
    CONSTRAINT ck_unidades_cep CHECK (cep IS NULL OR cep REGEXP '^[0-9]{8}$'),
    CONSTRAINT ck_unidades_ativo CHECK (ativo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Define quais unidades executam cada programa. Evita gravar o nome da unidade
-- repetidamente nas matriculas e demais tabelas.
CREATE TABLE IF NOT EXISTS programas_unidades (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    programa_id         BIGINT UNSIGNED NOT NULL,
    unidade_id          BIGINT UNSIGNED NOT NULL,
    data_inicio         DATE NOT NULL,
    data_fim            DATE NULL,
    ativo               TINYINT(1) NOT NULL DEFAULT 1,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_prog_unid_inicio (programa_id, unidade_id, data_inicio),
    KEY idx_prog_unid_unidade (unidade_id, ativo),
    KEY idx_prog_unid_programa (programa_id, ativo),
    CONSTRAINT fk_prog_unid_programa FOREIGN KEY (programa_id)
        REFERENCES programas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_prog_unid_unidade FOREIGN KEY (unidade_id)
        REFERENCES unidades (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_prog_unid_periodo CHECK (data_fim IS NULL OR data_fim >= data_inicio),
    CONSTRAINT ck_prog_unid_ativo CHECK (ativo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pessoa e a identidade civil comum a participante, responsavel e usuario.
-- CPF nao e armazenado em texto puro: a aplicacao grava o valor cifrado e um
-- HMAC-SHA-256 em cpf_busca para pesquisa/deduplicacao. A chave fica no .env.
CREATE TABLE IF NOT EXISTS pessoas (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'UUID gerado pela aplicacao',
    nome                VARCHAR(180) NOT NULL,
    nome_social         VARCHAR(180) NULL,
    data_nascimento     DATE NULL,
    sexo_codigo         VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NULL,
    cpf_cifrado         VARBINARY(512) NULL,
    cpf_busca           BINARY(32) NULL COMMENT 'HMAC-SHA-256 do CPF normalizado; nunca SHA simples',
    cpf_ultimos4        CHAR(4) CHARACTER SET ascii COLLATE ascii_bin NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    excluido_em         DATETIME(6) NULL,
    anonimizado_em      DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_pessoas_public_id (public_id),
    UNIQUE KEY uq_pessoas_cpf_busca (cpf_busca),
    KEY idx_pessoas_nome (nome),
    KEY idx_pessoas_nascimento (data_nascimento),
    -- Data futura deve ser recusada tambem pela camada de aplicacao. O limite
    -- inferior evita datas sentinela sem usar funcao nao deterministica no CHECK.
    CONSTRAINT ck_pessoas_nascimento CHECK (data_nascimento IS NULL OR data_nascimento >= '1900-01-01'),
    CONSTRAINT ck_pessoas_sexo CHECK (
        sexo_codigo IS NULL OR sexo_codigo IN ('FEMININO', 'MASCULINO', 'OUTRO', 'NAO_INFORMADO')
    ),
    CONSTRAINT ck_pessoas_cpf4 CHECK (cpf_ultimos4 IS NULL OR cpf_ultimos4 REGEXP '^[0-9]{4}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Telefones e e-mails podem se repetir entre integrantes da mesma familia.
-- valor_busca deve receber HMAC-SHA-256 do valor normalizado.
CREATE TABLE IF NOT EXISTS pessoas_contatos (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    pessoa_id           BIGINT UNSIGNED NOT NULL,
    tipo                VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    rotulo              VARCHAR(40) NULL,
    valor_cifrado       VARBINARY(768) NOT NULL,
    valor_busca         BINARY(32) NOT NULL,
    valor_mascarado     VARCHAR(80) NOT NULL,
    principal           TINYINT(1) NOT NULL DEFAULT 0,
    permite_whatsapp    TINYINT(1) NOT NULL DEFAULT 0,
    verificado_em       DATETIME(6) NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    excluido_em         DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_pessoa_contato (pessoa_id, tipo, valor_busca),
    KEY idx_contatos_busca (tipo, valor_busca),
    KEY idx_contatos_pessoa_principal (pessoa_id, principal),
    CONSTRAINT fk_contatos_pessoa FOREIGN KEY (pessoa_id)
        REFERENCES pessoas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_contatos_tipo CHECK (tipo IN ('TELEFONE', 'EMAIL')),
    CONSTRAINT ck_contatos_flags CHECK (principal IN (0, 1) AND permite_whatsapp IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pessoas_enderecos (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    pessoa_id           BIGINT UNSIGNED NOT NULL,
    tipo                VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'RESIDENCIAL',
    logradouro_cifrado  VARBINARY(768) NOT NULL,
    numero_cifrado      VARBINARY(256) NULL,
    complemento_cifrado VARBINARY(512) NULL,
    bairro              VARCHAR(100) NULL,
    cidade              VARCHAR(100) NOT NULL,
    uf                  CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    cep_cifrado         VARBINARY(256) NULL,
    principal           TINYINT(1) NOT NULL DEFAULT 1,
    valido_desde        DATE NULL,
    valido_ate          DATE NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_enderecos_pessoa (pessoa_id, principal),
    KEY idx_enderecos_localidade (cidade, uf),
    CONSTRAINT fk_enderecos_pessoa FOREIGN KEY (pessoa_id)
        REFERENCES pessoas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_enderecos_tipo CHECK (tipo IN ('RESIDENCIAL', 'CORRESPONDENCIA', 'OUTRO')),
    CONSTRAINT ck_enderecos_uf CHECK (uf REGEXP '^[A-Z]{2}$'),
    CONSTRAINT ck_enderecos_periodo CHECK (valido_ate IS NULL OR valido_desde IS NULL OR valido_ate >= valido_desde),
    CONSTRAINT ck_enderecos_principal CHECK (principal IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuarios (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'UUID gerado pela aplicacao',
    pessoa_id           BIGINT UNSIGNED NULL,
    unidade_id          BIGINT UNSIGNED NULL,
    login               VARCHAR(80) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
    email_login         VARCHAR(254) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
    senha_hash          VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'password_hash: Argon2id ou bcrypt',
    status              VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ATIVO',
    tentativas_falhas   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    bloqueado_ate       DATETIME(6) NULL,
    senha_alterada_em   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    ultimo_login_em     DATETIME(6) NULL,
    ultimo_login_ip     VARBINARY(16) NULL COMMENT 'INET6_ATON do IPv4/IPv6',
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    excluido_em         DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_usuarios_public_id (public_id),
    UNIQUE KEY uq_usuarios_login (login),
    UNIQUE KEY uq_usuarios_email (email_login),
    KEY idx_usuarios_pessoa (pessoa_id),
    KEY idx_usuarios_unidade_status (unidade_id, status),
    CONSTRAINT fk_usuarios_pessoa FOREIGN KEY (pessoa_id)
        REFERENCES pessoas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_usuarios_unidade FOREIGN KEY (unidade_id)
        REFERENCES unidades (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_usuarios_status CHECK (status IN ('ATIVO', 'BLOQUEADO', 'INATIVO'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS papeis (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo              VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nome                VARCHAR(100) NOT NULL,
    descricao           VARCHAR(500) NULL,
    sistema             TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Impede exclusao pela interface',
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_papeis_codigo (codigo),
    CONSTRAINT ck_papeis_sistema CHECK (sistema IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissoes (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo              VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    modulo              VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nome                VARCHAR(120) NOT NULL,
    descricao           VARCHAR(500) NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_permissoes_codigo (codigo),
    KEY idx_permissoes_modulo (modulo, nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Papeis globais e papeis por unidade ficam em tabelas diferentes. Essa
-- separacao evita a fragilidade de chaves unicas contendo unidade_id NULL.
CREATE TABLE IF NOT EXISTS usuarios_papeis (
    usuario_id          BIGINT UNSIGNED NOT NULL,
    papel_id            BIGINT UNSIGNED NOT NULL,
    concedido_por       BIGINT UNSIGNED NULL,
    concedido_em        DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    expira_em           DATETIME(6) NULL,
    PRIMARY KEY (usuario_id, papel_id),
    KEY idx_usu_papeis_papel (papel_id),
    KEY idx_usu_papeis_concedente (concedido_por),
    CONSTRAINT fk_usu_papeis_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_usu_papeis_papel FOREIGN KEY (papel_id)
        REFERENCES papeis (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_usu_papeis_concedente FOREIGN KEY (concedido_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_usu_papeis_expira CHECK (expira_em IS NULL OR expira_em >= concedido_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuarios_papeis_unidades (
    usuario_id          BIGINT UNSIGNED NOT NULL,
    papel_id            BIGINT UNSIGNED NOT NULL,
    unidade_id          BIGINT UNSIGNED NOT NULL,
    concedido_por       BIGINT UNSIGNED NULL,
    concedido_em        DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    expira_em           DATETIME(6) NULL,
    PRIMARY KEY (usuario_id, papel_id, unidade_id),
    KEY idx_usu_pap_unid_papel (papel_id),
    KEY idx_usu_pap_unid_unidade (unidade_id),
    KEY idx_usu_pap_unid_concedente (concedido_por),
    CONSTRAINT fk_upu_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_upu_papel FOREIGN KEY (papel_id)
        REFERENCES papeis (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_upu_unidade FOREIGN KEY (unidade_id)
        REFERENCES unidades (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_upu_concedente FOREIGN KEY (concedido_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_upu_expira CHECK (expira_em IS NULL OR expira_em >= concedido_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS papeis_permissoes (
    papel_id            BIGINT UNSIGNED NOT NULL,
    permissao_id        BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (papel_id, permissao_id),
    KEY idx_papel_perm_permissao (permissao_id),
    CONSTRAINT fk_papel_perm_papel FOREIGN KEY (papel_id)
        REFERENCES papeis (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_papel_perm_permissao FOREIGN KEY (permissao_id)
        REFERENCES permissoes (id) ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A aplicacao guarda somente o SHA-256 do identificador aleatorio da sessao.
CREATE TABLE IF NOT EXISTS usuarios_sessoes (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id          BIGINT UNSIGNED NOT NULL,
    token_hash          BINARY(32) NOT NULL,
    ip                  VARBINARY(16) NULL,
    user_agent          VARCHAR(500) NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    ultimo_acesso_em    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    expira_em           DATETIME(6) NOT NULL,
    revogado_em         DATETIME(6) NULL,
    motivo_revogacao    VARCHAR(120) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sessoes_token (token_hash),
    KEY idx_sessoes_usuario_ativas (usuario_id, revogado_em, expira_em),
    KEY idx_sessoes_expira (expira_em),
    CONSTRAINT fk_sessoes_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT ck_sessoes_expira CHECK (expira_em > criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tokens de redefinicao, verificacao de e-mail e primeiro acesso. Nunca grave o
-- token original; grave apenas seu hash e envie o original ao usuario.
CREATE TABLE IF NOT EXISTS usuarios_tokens (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id          BIGINT UNSIGNED NOT NULL,
    tipo                VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    token_hash          BINARY(32) NOT NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    expira_em           DATETIME(6) NOT NULL,
    utilizado_em        DATETIME(6) NULL,
    solicitado_ip       VARBINARY(16) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_usuarios_tokens_hash (token_hash),
    KEY idx_usuarios_tokens_uso (usuario_id, tipo, utilizado_em, expira_em),
    CONSTRAINT fk_usuarios_tokens_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT ck_usuarios_tokens_tipo CHECK (tipo IN ('PRIMEIRO_ACESSO', 'REDEFINIR_SENHA', 'VERIFICAR_EMAIL')),
    CONSTRAINT ck_usuarios_tokens_expira CHECK (expira_em > criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_tentativas (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    identificador_hash  BINARY(32) NOT NULL COMMENT 'HMAC do login/e-mail normalizado',
    ip                  VARBINARY(16) NULL,
    sucesso             TINYINT(1) NOT NULL,
    motivo              VARCHAR(80) NULL,
    ocorrido_em         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_login_identificador_data (identificador_hash, ocorrido_em),
    KEY idx_login_ip_data (ip, ocorrido_em),
    CONSTRAINT ck_login_sucesso CHECK (sucesso IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Auditoria append-only. A conta da aplicacao deve possuir apenas INSERT e
-- SELECT nesta tabela. Nao registrar senhas, tokens, CPF ou dados de saude em
-- texto puro nos metadados.
CREATE TABLE IF NOT EXISTS auditoria_eventos (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    usuario_id          BIGINT UNSIGNED NULL,
    acao                VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    entidade            VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    entidade_id         BIGINT UNSIGNED NULL,
    entidade_public_id  CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    request_id          CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ip                  VARBINARY(16) NULL,
    user_agent          VARCHAR(500) NULL,
    metadados_json      LONGTEXT NULL,
    dados_cifrados      LONGBLOB NULL COMMENT 'Diff sensivel cifrado pela aplicacao, quando indispensavel',
    ocorrido_em         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_auditoria_public_id (public_id),
    KEY idx_auditoria_usuario_data (usuario_id, ocorrido_em),
    KEY idx_auditoria_entidade (entidade, entidade_id, ocorrido_em),
    KEY idx_auditoria_request (request_id),
    CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_auditoria_json CHECK (metadados_json IS NULL OR JSON_VALID(metadados_json))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
