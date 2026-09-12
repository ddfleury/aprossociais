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


-- ============================================================================
-- NOVO PROJETO APROS - MIGRACAO 002
-- Participantes, responsaveis, turmas, matriculas, transferencias e documentos
-- Requer: 001_core_seguranca.sql
-- ============================================================================

SET time_zone = '+00:00';
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

CREATE TABLE IF NOT EXISTS participantes (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'UUID gerado pela aplicacao',
    pessoa_id           BIGINT UNSIGNED NOT NULL,
    nome_guerra         VARCHAR(100) NULL,
    tipo_sanguineo      VARCHAR(3) CHARACTER SET ascii COLLATE ascii_bin NULL,
    observacao_cifrada  LONGBLOB NULL COMMENT 'Somente quando indispensavel; criptografia na aplicacao',
    ativo               TINYINT(1) NOT NULL DEFAULT 1,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    excluido_em         DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_participantes_public_id (public_id),
    UNIQUE KEY uq_participantes_pessoa (pessoa_id),
    KEY idx_participantes_ativo (ativo),
    CONSTRAINT fk_participantes_pessoa FOREIGN KEY (pessoa_id)
        REFERENCES pessoas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_participantes_sangue CHECK (
        tipo_sanguineo IS NULL OR tipo_sanguineo IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
    ),
    CONSTRAINT ck_participantes_ativo CHECK (ativo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- O responsavel tambem e uma pessoa. Essa tabela permite varios responsaveis,
-- preserva o papel de cada um e nao repete nomes/telefones dentro do aluno.
CREATE TABLE IF NOT EXISTS participantes_responsaveis (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    participante_id         BIGINT UNSIGNED NOT NULL,
    responsavel_pessoa_id   BIGINT UNSIGNED NOT NULL,
    parentesco_codigo       VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    responsavel_legal       TINYINT(1) NOT NULL DEFAULT 0,
    autorizado_retirada     TINYINT(1) NOT NULL DEFAULT 0,
    valido_desde            DATE NOT NULL,
    valido_ate              DATE NULL,
    criado_por              BIGINT UNSIGNED NULL,
    criado_em               DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_part_resp_id_part (id, participante_id),
    UNIQUE KEY uq_part_resp_inicio (participante_id, responsavel_pessoa_id, parentesco_codigo, valido_desde),
    KEY idx_part_resp_responsavel (responsavel_pessoa_id),
    KEY idx_part_resp_vigencia (participante_id, valido_ate),
    KEY idx_part_resp_criador (criado_por),
    CONSTRAINT fk_part_resp_participante FOREIGN KEY (participante_id)
        REFERENCES participantes (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_part_resp_pessoa FOREIGN KEY (responsavel_pessoa_id)
        REFERENCES pessoas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_part_resp_criador FOREIGN KEY (criado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_part_resp_flags CHECK (
        responsavel_legal IN (0, 1) AND autorizado_retirada IN (0, 1)
    ),
    CONSTRAINT ck_part_resp_periodo CHECK (valido_ate IS NULL OR valido_ate >= valido_desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Garante no banco um unico contato principal por participante. O vinculo deve
-- ser trocado na mesma transacao em que o responsavel principal for alterado.
CREATE TABLE IF NOT EXISTS participantes_responsavel_principal (
    participante_id         BIGINT UNSIGNED NOT NULL,
    participante_responsavel_id BIGINT UNSIGNED NOT NULL,
    atualizado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (participante_id),
    UNIQUE KEY uq_part_resp_principal_vinc (participante_responsavel_id),
    KEY idx_part_resp_princ_comp (participante_responsavel_id, participante_id),
    CONSTRAINT fk_prp_vinculo FOREIGN KEY (participante_responsavel_id, participante_id)
        REFERENCES participantes_responsaveis (id, participante_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS escolas (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    codigo_inep         CHAR(8) CHARACTER SET ascii COLLATE ascii_bin NULL,
    nome                VARCHAR(180) NOT NULL,
    cidade              VARCHAR(100) NOT NULL,
    uf                  CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    ativo               TINYINT(1) NOT NULL DEFAULT 1,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_escolas_public_id (public_id),
    UNIQUE KEY uq_escolas_inep (codigo_inep),
    KEY idx_escolas_nome_local (nome, cidade),
    CONSTRAINT ck_escolas_inep CHECK (codigo_inep IS NULL OR codigo_inep REGEXP '^[0-9]{8}$'),
    CONSTRAINT ck_escolas_uf CHECK (uf REGEXP '^[A-Z]{2}$'),
    CONSTRAINT ck_escolas_ativo CHECK (ativo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historico escolar: uma troca de escola nao apaga o registro anterior.
CREATE TABLE IF NOT EXISTS participantes_escolaridade (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    participante_id     BIGINT UNSIGNED NOT NULL,
    escola_id           BIGINT UNSIGNED NULL,
    escola_nome_snapshot VARCHAR(180) NULL,
    serie_ano           VARCHAR(30) NULL,
    turno_codigo        VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ano_letivo          SMALLINT UNSIGNED NOT NULL,
    data_inicio         DATE NULL,
    data_fim            DATE NULL,
    criado_por          BIGINT UNSIGNED NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_escolar_part_ano (participante_id, ano_letivo),
    KEY idx_escolar_escola (escola_id, ano_letivo),
    KEY idx_escolar_criador (criado_por),
    CONSTRAINT fk_escolar_participante FOREIGN KEY (participante_id)
        REFERENCES participantes (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_escolar_escola FOREIGN KEY (escola_id)
        REFERENCES escolas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_escolar_criador FOREIGN KEY (criado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_escolar_turno CHECK (
        turno_codigo IS NULL OR turno_codigo IN ('MATUTINO', 'VESPERTINO', 'NOTURNO', 'INTEGRAL', 'OUTRO')
    ),
    CONSTRAINT ck_escolar_ano CHECK (ano_letivo BETWEEN 2000 AND 2200),
    CONSTRAINT ck_escolar_periodo CHECK (data_fim IS NULL OR data_inicio IS NULL OR data_fim >= data_inicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS turmas (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    programa_unidade_id BIGINT UNSIGNED NOT NULL,
    codigo              VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nome                VARCHAR(120) NOT NULL,
    ano_referencia      SMALLINT UNSIGNED NOT NULL,
    turno_codigo        VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    pelotao             VARCHAR(20) NULL,
    idade_minima        TINYINT UNSIGNED NULL,
    idade_maxima        TINYINT UNSIGNED NULL,
    capacidade          SMALLINT UNSIGNED NULL,
    data_inicio         DATE NOT NULL,
    data_fim            DATE NULL,
    status              VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ATIVA',
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_turmas_public_id (public_id),
    UNIQUE KEY uq_turmas_codigo_ano (programa_unidade_id, codigo, ano_referencia),
    UNIQUE KEY uq_turmas_id_prog_unid (id, programa_unidade_id),
    KEY idx_turmas_consulta (programa_unidade_id, ano_referencia, status, turno_codigo),
    CONSTRAINT fk_turmas_prog_unid FOREIGN KEY (programa_unidade_id)
        REFERENCES programas_unidades (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_turmas_ano CHECK (ano_referencia BETWEEN 2000 AND 2200),
    CONSTRAINT ck_turmas_turno CHECK (turno_codigo IN ('MATUTINO', 'VESPERTINO', 'NOTURNO', 'INTEGRAL', 'OUTRO')),
    CONSTRAINT ck_turmas_idade CHECK (idade_minima IS NULL OR idade_maxima IS NULL OR idade_minima <= idade_maxima),
    CONSTRAINT ck_turmas_periodo CHECK (data_fim IS NULL OR data_fim >= data_inicio),
    CONSTRAINT ck_turmas_status CHECK (status IN ('PLANEJADA', 'ATIVA', 'ENCERRADA', 'CANCELADA'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS matriculas (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    numero              VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    participante_id     BIGINT UNSIGNED NOT NULL,
    programa_id         BIGINT UNSIGNED NOT NULL,
    data_matricula      DATE NOT NULL,
    status              VARCHAR(25) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ATIVA',
    graduacao_codigo    VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
    data_encerramento   DATE NULL,
    motivo_encerramento VARCHAR(500) NULL,
    criado_por          BIGINT UNSIGNED NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_matriculas_public_id (public_id),
    UNIQUE KEY uq_matriculas_numero (numero),
    UNIQUE KEY uq_matriculas_part_prog_data (participante_id, programa_id, data_matricula),
    KEY idx_matriculas_programa_status (programa_id, status),
    KEY idx_matriculas_participante (participante_id, status),
    KEY idx_matriculas_criador (criado_por),
    CONSTRAINT fk_matriculas_participante FOREIGN KEY (participante_id)
        REFERENCES participantes (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_matriculas_programa FOREIGN KEY (programa_id)
        REFERENCES programas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_matriculas_criador FOREIGN KEY (criado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_matriculas_status CHECK (
        status IN ('PRE_MATRICULA', 'ATIVA', 'SUSPENSA', 'ENCERRADA', 'CANCELADA')
    ),
    CONSTRAINT ck_matriculas_periodo CHECK (
        data_encerramento IS NULL OR data_encerramento >= data_matricula
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada linha representa um periodo real da matricula em uma unidade/turma.
-- Uma transferencia encerra o vinculo anterior e cria outro; nada e sobrescrito.
CREATE TABLE IF NOT EXISTS matriculas_vinculos (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    matricula_id        BIGINT UNSIGNED NOT NULL,
    programa_unidade_id BIGINT UNSIGNED NOT NULL,
    turma_id            BIGINT UNSIGNED NULL,
    data_inicio         DATE NOT NULL,
    data_fim            DATE NULL,
    motivo_fim          VARCHAR(500) NULL,
    criado_por          BIGINT UNSIGNED NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_mat_vinc_id_mat (id, matricula_id),
    UNIQUE KEY uq_mat_vinc_inicio (matricula_id, programa_unidade_id, data_inicio),
    KEY idx_mat_vinc_atual (matricula_id, data_fim),
    KEY idx_mat_vinc_unidade (programa_unidade_id, data_inicio, data_fim),
    KEY idx_mat_vinc_turma_prog (turma_id, programa_unidade_id),
    KEY idx_mat_vinc_criador (criado_por),
    CONSTRAINT fk_mat_vinc_matricula FOREIGN KEY (matricula_id)
        REFERENCES matriculas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_mat_vinc_prog_unid FOREIGN KEY (programa_unidade_id)
        REFERENCES programas_unidades (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_mat_vinc_turma FOREIGN KEY (turma_id, programa_unidade_id)
        REFERENCES turmas (id, programa_unidade_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_mat_vinc_criador FOREIGN KEY (criado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_mat_vinc_periodo CHECK (data_fim IS NULL OR data_fim >= data_inicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Um unico ponteiro atual por matricula, sem depender de indice parcial ou de
-- coluna gerada. Atualize esta tabela na mesma transacao da transferencia.
CREATE TABLE IF NOT EXISTS matriculas_vinculo_atual (
    matricula_id        BIGINT UNSIGNED NOT NULL,
    vinculo_id          BIGINT UNSIGNED NOT NULL,
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (matricula_id),
    UNIQUE KEY uq_mat_vinc_atual_vinculo (vinculo_id),
    KEY idx_mat_vinc_atual_composto (vinculo_id, matricula_id),
    CONSTRAINT fk_mva_vinculo FOREIGN KEY (vinculo_id, matricula_id)
        REFERENCES matriculas_vinculos (id, matricula_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS matriculas_transferencias (
    id                          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id                   CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    matricula_id                BIGINT UNSIGNED NOT NULL,
    origem_vinculo_id           BIGINT UNSIGNED NOT NULL,
    destino_programa_unidade_id BIGINT UNSIGNED NOT NULL,
    destino_turma_id            BIGINT UNSIGNED NULL,
    destino_vinculo_id          BIGINT UNSIGNED NULL,
    motivo                      VARCHAR(500) NOT NULL,
    observacao_cifrada          LONGBLOB NULL,
    status                      VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'SOLICITADA',
    solicitada_por              BIGINT UNSIGNED NOT NULL,
    solicitada_em               DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    analisada_por               BIGINT UNSIGNED NULL,
    analisada_em                DATETIME(6) NULL,
    efetivada_por               BIGINT UNSIGNED NULL,
    efetivada_em                DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_transferencias_public_id (public_id),
    UNIQUE KEY uq_transferencias_dest_vinc (destino_vinculo_id),
    KEY idx_transferencias_fila (status, solicitada_em),
    KEY idx_transferencias_matricula (matricula_id, solicitada_em),
    KEY idx_transf_origem_comp (origem_vinculo_id, matricula_id),
    KEY idx_transf_dest_comp (destino_vinculo_id, matricula_id),
    KEY idx_transf_dest_turma (destino_turma_id, destino_programa_unidade_id),
    KEY idx_transf_solicitante (solicitada_por),
    KEY idx_transf_analista (analisada_por),
    KEY idx_transf_efetivador (efetivada_por),
    CONSTRAINT fk_transf_matricula FOREIGN KEY (matricula_id)
        REFERENCES matriculas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_transf_origem FOREIGN KEY (origem_vinculo_id, matricula_id)
        REFERENCES matriculas_vinculos (id, matricula_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_transf_dest_prog_unid FOREIGN KEY (destino_programa_unidade_id)
        REFERENCES programas_unidades (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_transf_dest_turma FOREIGN KEY (destino_turma_id, destino_programa_unidade_id)
        REFERENCES turmas (id, programa_unidade_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_transf_dest_vinc FOREIGN KEY (destino_vinculo_id, matricula_id)
        REFERENCES matriculas_vinculos (id, matricula_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_transf_solicitante FOREIGN KEY (solicitada_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_transf_analista FOREIGN KEY (analisada_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    -- O efetivador faz parte do historico permanente da transferencia.
    -- Contas devem ser inativadas, nao excluidas fisicamente. RESTRICT tambem
    -- evita a combinacao incompativel entre CHECK e ON DELETE SET NULL.
    CONSTRAINT fk_transf_efetivador FOREIGN KEY (efetivada_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_transferencias_status CHECK (
        status IN ('SOLICITADA', 'APROVADA', 'RECUSADA', 'EFETIVADA', 'CANCELADA')
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MySQL e MariaDB restringem CHECKs que usam colunas sujeitas a acoes de
-- chaves estrangeiras. Os gatilhos abaixo preservam as mesmas regras sem
-- enfraquecer a integridade referencial.
DROP TRIGGER IF EXISTS trg_mat_transf_bi_consistencia;
DROP TRIGGER IF EXISTS trg_mat_transf_bu_consistencia;

DELIMITER $$

CREATE TRIGGER trg_mat_transf_bi_consistencia
BEFORE INSERT ON matriculas_transferencias
FOR EACH ROW
BEGIN
    IF NEW.destino_vinculo_id IS NOT NULL
       AND NEW.destino_vinculo_id = NEW.origem_vinculo_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Transferencia invalida: os vinculos de origem e destino devem ser diferentes';
    END IF;

    IF NEW.status = 'EFETIVADA'
       AND (NEW.destino_vinculo_id IS NULL
            OR NEW.efetivada_por IS NULL
            OR NEW.efetivada_em IS NULL) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Transferencia efetivada exige vinculo de destino, usuario e data de efetivacao';
    END IF;
END$$

CREATE TRIGGER trg_mat_transf_bu_consistencia
BEFORE UPDATE ON matriculas_transferencias
FOR EACH ROW
BEGIN
    IF NEW.destino_vinculo_id IS NOT NULL
       AND NEW.destino_vinculo_id = NEW.origem_vinculo_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Transferencia invalida: os vinculos de origem e destino devem ser diferentes';
    END IF;

    IF NEW.status = 'EFETIVADA'
       AND (NEW.destino_vinculo_id IS NULL
            OR NEW.efetivada_por IS NULL
            OR NEW.efetivada_em IS NULL) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Transferencia efetivada exige vinculo de destino, usuario e data de efetivacao';
    END IF;
END$$

DELIMITER ;

-- Eventos cadastrais legiveis por maquina. Use tipo_evento em vez de depender
-- apenas de um texto longo para descobrir o que aconteceu.
CREATE TABLE IF NOT EXISTS participantes_historico (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    participante_id     BIGINT UNSIGNED NOT NULL,
    matricula_id        BIGINT UNSIGNED NULL,
    tipo_evento         VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    resumo              VARCHAR(500) NOT NULL,
    detalhes_json       LONGTEXT NULL,
    dados_cifrados      LONGBLOB NULL,
    usuario_id          BIGINT UNSIGNED NULL,
    ocorrido_em         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_part_hist_public_id (public_id),
    KEY idx_part_hist_part_data (participante_id, ocorrido_em),
    KEY idx_part_hist_mat_data (matricula_id, ocorrido_em),
    KEY idx_part_hist_tipo_data (tipo_evento, ocorrido_em),
    KEY idx_part_hist_usuario (usuario_id),
    CONSTRAINT fk_part_hist_participante FOREIGN KEY (participante_id)
        REFERENCES participantes (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_part_hist_matricula FOREIGN KEY (matricula_id)
        REFERENCES matriculas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_part_hist_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_part_hist_json CHECK (detalhes_json IS NULL OR JSON_VALID(detalhes_json))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dados de saude exigem permissao especifica e sao cifrados integralmente pela
-- aplicacao. categoria permite filtrar sem revelar o conteudo clinico.
CREATE TABLE IF NOT EXISTS participantes_saude (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    participante_id     BIGINT UNSIGNED NOT NULL,
    categoria           VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    descricao_cifrada  LONGBLOB NOT NULL,
    gera_alerta         TINYINT(1) NOT NULL DEFAULT 0,
    valido_desde        DATE NULL,
    valido_ate          DATE NULL,
    criado_por          BIGINT UNSIGNED NOT NULL,
    atualizado_por      BIGINT UNSIGNED NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_saude_part_categoria (participante_id, categoria, valido_ate),
    KEY idx_saude_alerta (gera_alerta, valido_ate),
    KEY idx_saude_criador (criado_por),
    KEY idx_saude_atualizador (atualizado_por),
    CONSTRAINT fk_saude_participante FOREIGN KEY (participante_id)
        REFERENCES participantes (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_saude_criador FOREIGN KEY (criado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_saude_atualizador FOREIGN KEY (atualizado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_saude_categoria CHECK (
        categoria IN ('ALERGIA', 'MEDICAMENTO', 'CONDICAO', 'RESTRICAO', 'NECESSIDADE_ESPECIAL', 'OUTRO')
    ),
    CONSTRAINT ck_saude_alerta CHECK (gera_alerta IN (0, 1)),
    CONSTRAINT ck_saude_periodo CHECK (valido_ate IS NULL OR valido_desde IS NULL OR valido_ate >= valido_desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consentimentos_tipos (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo              VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nome                VARCHAR(150) NOT NULL,
    descricao           VARCHAR(500) NULL,
    exige_responsavel   TINYINT(1) NOT NULL DEFAULT 1,
    ativo               TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_consent_tipos_codigo (codigo),
    CONSTRAINT ck_consent_tipos_flags CHECK (exige_responsavel IN (0, 1) AND ativo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consentimentos (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    participante_id     BIGINT UNSIGNED NOT NULL,
    tipo_id             BIGINT UNSIGNED NOT NULL,
    responsavel_pessoa_id BIGINT UNSIGNED NULL,
    versao_termo        VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    concedido           TINYINT(1) NOT NULL,
    concedido_em        DATETIME(6) NOT NULL,
    revogado_em         DATETIME(6) NULL,
    evidencia_hash      BINARY(32) NOT NULL COMMENT 'SHA-256 do termo/arquivo aceito',
    ip                  VARBINARY(16) NULL,
    user_agent          VARCHAR(500) NULL,
    registrado_por      BIGINT UNSIGNED NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_consent_public_id (public_id),
    UNIQUE KEY uq_consent_id_part (id, participante_id),
    KEY idx_consent_part_tipo (participante_id, tipo_id, concedido_em),
    KEY idx_consent_responsavel (responsavel_pessoa_id),
    KEY idx_consent_registrador (registrado_por),
    CONSTRAINT fk_consent_participante FOREIGN KEY (participante_id)
        REFERENCES participantes (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_consent_tipo FOREIGN KEY (tipo_id)
        REFERENCES consentimentos_tipos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_consent_responsavel FOREIGN KEY (responsavel_pessoa_id)
        REFERENCES pessoas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_consent_registrador FOREIGN KEY (registrado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_consent_concedido CHECK (concedido IN (0, 1)),
    CONSTRAINT ck_consent_revogacao CHECK (revogado_em IS NULL OR revogado_em >= concedido_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documentos_tipos (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo              VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nome                VARCHAR(150) NOT NULL,
    contem_dado_sensivel TINYINT(1) NOT NULL DEFAULT 0,
    validade_meses      SMALLINT UNSIGNED NULL,
    ativo               TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_doc_tipos_codigo (codigo),
    CONSTRAINT ck_doc_tipos_flags CHECK (contem_dado_sensivel IN (0, 1) AND ativo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- O arquivo deve ficar fora de public_html ou em armazenamento privado. O banco
-- guarda apenas metadados e uma chave interna, nunca uma URL publica permanente.
CREATE TABLE IF NOT EXISTS documentos (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    participante_id     BIGINT UNSIGNED NOT NULL,
    tipo_id             BIGINT UNSIGNED NOT NULL,
    consentimento_id    BIGINT UNSIGNED NULL,
    storage_key         VARCHAR(500) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nome_original       VARCHAR(255) NOT NULL,
    extensao            VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    mime_type           VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    tamanho_bytes       BIGINT UNSIGNED NOT NULL,
    hash_sha256         BINARY(32) NOT NULL,
    status              VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ATIVO',
    valido_ate          DATE NULL,
    enviado_por         BIGINT UNSIGNED NOT NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    excluido_em         DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_documentos_public_id (public_id),
    UNIQUE KEY uq_documentos_storage_key (storage_key),
    KEY idx_documentos_part_tipo (participante_id, tipo_id, status),
    KEY idx_documentos_hash (hash_sha256),
    KEY idx_documentos_validade (valido_ate, status),
    KEY idx_documentos_consent_part (consentimento_id, participante_id),
    KEY idx_documentos_enviado_por (enviado_por),
    CONSTRAINT fk_documentos_participante FOREIGN KEY (participante_id)
        REFERENCES participantes (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_documentos_tipo FOREIGN KEY (tipo_id)
        REFERENCES documentos_tipos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_documentos_consentimento FOREIGN KEY (consentimento_id, participante_id)
        REFERENCES consentimentos (id, participante_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_documentos_usuario FOREIGN KEY (enviado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_documentos_status CHECK (status IN ('ATIVO', 'SUBSTITUIDO', 'REVOGADO', 'EXCLUIDO')),
    CONSTRAINT ck_documentos_tamanho CHECK (tamanho_bytes > 0),
    CONSTRAINT ck_documentos_extensao CHECK (extensao REGEXP '^[a-z0-9]{1,10}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documentos_acessos (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    documento_id        BIGINT UNSIGNED NOT NULL,
    usuario_id          BIGINT UNSIGNED NULL,
    acao                VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    finalidade          VARCHAR(200) NOT NULL,
    ip                  VARBINARY(16) NULL,
    ocorrido_em         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_doc_acesso_documento (documento_id, ocorrido_em),
    KEY idx_doc_acesso_usuario (usuario_id, ocorrido_em),
    CONSTRAINT fk_doc_acesso_documento FOREIGN KEY (documento_id)
        REFERENCES documentos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_doc_acesso_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_doc_acesso_acao CHECK (acao IN ('VISUALIZAR', 'BAIXAR', 'ENVIAR', 'EXCLUIR'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- NOVO PROJETO APROS - MIGRACAO 003
-- Curriculo, planos, atividades, encontros, frequencia e avaliacoes
-- Requer: 001_core_seguranca.sql e 002_participantes_matriculas.sql
-- ============================================================================

SET time_zone = '+00:00';
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

CREATE TABLE IF NOT EXISTS componentes_curriculares (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    programa_id         BIGINT UNSIGNED NOT NULL,
    codigo              VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nome                VARCHAR(180) NOT NULL,
    eixo                VARCHAR(150) NULL,
    descricao           TEXT NULL,
    ordem               SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    ativo               TINYINT(1) NOT NULL DEFAULT 1,
    criado_por          BIGINT UNSIGNED NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_componentes_public_id (public_id),
    UNIQUE KEY uq_componentes_codigo (programa_id, codigo),
    KEY idx_componentes_lista (programa_id, ativo, ordem, nome),
    KEY idx_componentes_criador (criado_por),
    CONSTRAINT fk_componentes_programa FOREIGN KEY (programa_id)
        REFERENCES programas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_componentes_criador FOREIGN KEY (criado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_componentes_ativo CHECK (ativo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS matrizes_curriculares (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    programa_id         BIGINT UNSIGNED NOT NULL,
    nome                VARCHAR(180) NOT NULL,
    ano_inicio          SMALLINT UNSIGNED NOT NULL,
    ano_fim             SMALLINT UNSIGNED NULL,
    status              VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'RASCUNHO',
    observacoes         TEXT NULL,
    criado_por          BIGINT UNSIGNED NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_por      BIGINT UNSIGNED NULL,
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_matrizes_public_id (public_id),
    UNIQUE KEY uq_matrizes_nome_inicio (programa_id, nome, ano_inicio),
    KEY idx_matrizes_consulta (programa_id, status, ano_inicio, ano_fim),
    KEY idx_matrizes_criador (criado_por),
    KEY idx_matrizes_atualizador (atualizado_por),
    CONSTRAINT fk_matrizes_programa FOREIGN KEY (programa_id)
        REFERENCES programas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_matrizes_criador FOREIGN KEY (criado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT fk_matrizes_atualizador FOREIGN KEY (atualizado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_matrizes_anos CHECK (ano_inicio BETWEEN 2000 AND 2200 AND (ano_fim IS NULL OR ano_fim >= ano_inicio)),
    CONSTRAINT ck_matrizes_status CHECK (status IN ('RASCUNHO', 'PUBLICADA', 'ARQUIVADA'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS matrizes_componentes (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    matriz_id           BIGINT UNSIGNED NOT NULL,
    componente_id       BIGINT UNSIGNED NOT NULL,
    faixa_codigo        VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'GERAL',
    faixa_idade_min     TINYINT UNSIGNED NULL,
    faixa_idade_max     TINYINT UNSIGNED NULL,
    carga_minutos       INT UNSIGNED NOT NULL,
    frequencia_minima   DECIMAL(5,2) NULL,
    nota_minima         DECIMAL(7,2) NULL,
    obrigatorio         TINYINT(1) NOT NULL DEFAULT 1,
    ordem               SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_matriz_comp_faixa (matriz_id, componente_id, faixa_codigo),
    KEY idx_matriz_comp_componente (componente_id),
    KEY idx_matriz_comp_ordem (matriz_id, ordem),
    CONSTRAINT fk_matriz_comp_matriz FOREIGN KEY (matriz_id)
        REFERENCES matrizes_curriculares (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_matriz_comp_componente FOREIGN KEY (componente_id)
        REFERENCES componentes_curriculares (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_matriz_comp_idade CHECK (
        faixa_idade_min IS NULL OR faixa_idade_max IS NULL OR faixa_idade_min <= faixa_idade_max
    ),
    CONSTRAINT ck_matriz_comp_carga CHECK (carga_minutos > 0),
    CONSTRAINT ck_matriz_comp_freq CHECK (frequencia_minima IS NULL OR frequencia_minima BETWEEN 0 AND 100),
    CONSTRAINT ck_matriz_comp_obrig CHECK (obrigatorio IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS planos_aula (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    programa_id         BIGINT UNSIGNED NOT NULL,
    titulo              VARCHAR(255) NOT NULL,
    tema                VARCHAR(255) NULL,
    descricao           TEXT NULL,
    objetivos           TEXT NULL,
    habilidades         TEXT NULL,
    conteudos           TEXT NULL,
    metodologia         LONGTEXT NULL,
    desenvolvimento     LONGTEXT NULL,
    materiais           TEXT NULL,
    avaliacao           TEXT NULL,
    seguranca           TEXT NULL,
    carga_minutos       SMALLINT UNSIGNED NULL,
    status              VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'RASCUNHO',
    versao              INT UNSIGNED NOT NULL DEFAULT 1,
    criado_por          BIGINT UNSIGNED NOT NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_por      BIGINT UNSIGNED NULL,
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    excluido_em         DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_planos_public_id (public_id),
    KEY idx_planos_programa_status (programa_id, status, atualizado_em),
    KEY idx_planos_criador (criado_por, criado_em),
    KEY idx_planos_atualizador (atualizado_por),
    CONSTRAINT fk_planos_programa FOREIGN KEY (programa_id)
        REFERENCES programas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_planos_criador FOREIGN KEY (criado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_planos_atualizador FOREIGN KEY (atualizado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_planos_status CHECK (status IN ('RASCUNHO', 'PUBLICADO', 'ARQUIVADO')),
    CONSTRAINT ck_planos_versao CHECK (versao > 0),
    CONSTRAINT ck_planos_carga CHECK (carga_minutos IS NULL OR carga_minutos > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Associacao realmente N:N; nao utiliza UNIQUE(plano_id) isolado.
CREATE TABLE IF NOT EXISTS planos_componentes (
    plano_id            BIGINT UNSIGNED NOT NULL,
    matriz_componente_id BIGINT UNSIGNED NOT NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (plano_id, matriz_componente_id),
    KEY idx_planos_comp_matriz (matriz_componente_id),
    CONSTRAINT fk_planos_comp_plano FOREIGN KEY (plano_id)
        REFERENCES planos_aula (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_planos_comp_matriz FOREIGN KEY (matriz_componente_id)
        REFERENCES matrizes_componentes (id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS planos_faixas_etarias (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    plano_id            BIGINT UNSIGNED NOT NULL,
    idade_minima        TINYINT UNSIGNED NOT NULL,
    idade_maxima        TINYINT UNSIGNED NOT NULL,
    observacao          VARCHAR(500) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_planos_faixa (plano_id, idade_minima, idade_maxima),
    CONSTRAINT fk_planos_faixa_plano FOREIGN KEY (plano_id)
        REFERENCES planos_aula (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT ck_planos_faixa_idade CHECK (idade_minima <= idade_maxima)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS planos_arquivos (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    plano_id            BIGINT UNSIGNED NOT NULL,
    storage_key         VARCHAR(500) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nome_original       VARCHAR(255) NOT NULL,
    extensao            VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    mime_type           VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    tamanho_bytes       BIGINT UNSIGNED NOT NULL,
    hash_sha256         BINARY(32) NOT NULL,
    descricao           VARCHAR(500) NULL,
    enviado_por         BIGINT UNSIGNED NOT NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    excluido_em         DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_planos_arq_public_id (public_id),
    UNIQUE KEY uq_planos_arq_storage (storage_key),
    KEY idx_planos_arq_plano (plano_id, excluido_em),
    KEY idx_planos_arq_hash (hash_sha256),
    KEY idx_planos_arq_usuario (enviado_por),
    CONSTRAINT fk_planos_arq_plano FOREIGN KEY (plano_id)
        REFERENCES planos_aula (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_planos_arq_usuario FOREIGN KEY (enviado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_planos_arq_tamanho CHECK (tamanho_bytes > 0),
    CONSTRAINT ck_planos_arq_ext CHECK (extensao REGEXP '^[a-z0-9]{1,10}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS atividades (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    programa_id         BIGINT UNSIGNED NOT NULL,
    componente_id       BIGINT UNSIGNED NULL,
    codigo              VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nome                VARCHAR(180) NOT NULL,
    descricao           TEXT NULL,
    ativo               TINYINT(1) NOT NULL DEFAULT 1,
    criado_por          BIGINT UNSIGNED NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_atividades_public_id (public_id),
    UNIQUE KEY uq_atividades_codigo (programa_id, codigo),
    KEY idx_atividades_lista (programa_id, ativo, nome),
    KEY idx_atividades_componente (componente_id),
    KEY idx_atividades_criador (criado_por),
    CONSTRAINT fk_atividades_programa FOREIGN KEY (programa_id)
        REFERENCES programas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_atividades_componente FOREIGN KEY (componente_id)
        REFERENCES componentes_curriculares (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_atividades_criador FOREIGN KEY (criado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_atividades_ativo CHECK (ativo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS atividades_ofertas (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    atividade_id        BIGINT UNSIGNED NOT NULL,
    programa_unidade_id BIGINT UNSIGNED NOT NULL,
    turma_id            BIGINT UNSIGNED NULL,
    data_inicio         DATE NOT NULL,
    data_fim            DATE NULL,
    capacidade          SMALLINT UNSIGNED NULL,
    status              VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ATIVA',
    criado_por          BIGINT UNSIGNED NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_ofertas_public_id (public_id),
    UNIQUE KEY uq_ofertas_inicio (atividade_id, programa_unidade_id, turma_id, data_inicio),
    KEY idx_ofertas_consulta (programa_unidade_id, status, data_inicio, data_fim),
    KEY idx_ofertas_turma_prog (turma_id, programa_unidade_id),
    KEY idx_ofertas_criador (criado_por),
    CONSTRAINT fk_ofertas_atividade FOREIGN KEY (atividade_id)
        REFERENCES atividades (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_ofertas_prog_unid FOREIGN KEY (programa_unidade_id)
        REFERENCES programas_unidades (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_ofertas_turma FOREIGN KEY (turma_id, programa_unidade_id)
        REFERENCES turmas (id, programa_unidade_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_ofertas_criador FOREIGN KEY (criado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_ofertas_periodo CHECK (data_fim IS NULL OR data_fim >= data_inicio),
    CONSTRAINT ck_ofertas_status CHECK (status IN ('PLANEJADA', 'ATIVA', 'ENCERRADA', 'CANCELADA'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS atividades_horarios (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    oferta_id           BIGINT UNSIGNED NOT NULL,
    dia_semana          TINYINT UNSIGNED NOT NULL COMMENT '1=segunda ... 7=domingo',
    hora_inicio         TIME NOT NULL,
    hora_fim            TIME NOT NULL,
    valido_desde        DATE NOT NULL,
    valido_ate          DATE NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_horarios_oferta (oferta_id, dia_semana, hora_inicio, valido_desde),
    CONSTRAINT fk_horarios_oferta FOREIGN KEY (oferta_id)
        REFERENCES atividades_ofertas (id) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT ck_horarios_dia CHECK (dia_semana BETWEEN 1 AND 7),
    CONSTRAINT ck_horarios_horas CHECK (hora_fim > hora_inicio),
    CONSTRAINT ck_horarios_periodo CHECK (valido_ate IS NULL OR valido_ate >= valido_desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS encontros (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    oferta_id           BIGINT UNSIGNED NOT NULL,
    plano_id            BIGINT UNSIGNED NULL,
    inicio_em           DATETIME(6) NOT NULL,
    fim_em              DATETIME(6) NOT NULL,
    local_descricao     VARCHAR(180) NULL,
    instrutor_id        BIGINT UNSIGNED NULL,
    status              VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'AGENDADO',
    observacao          TEXT NULL,
    fechado_por         BIGINT UNSIGNED NULL,
    fechado_em          DATETIME(6) NULL,
    criado_por          BIGINT UNSIGNED NOT NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_encontros_public_id (public_id),
    UNIQUE KEY uq_encontros_oferta_inicio (oferta_id, inicio_em),
    KEY idx_encontros_periodo (inicio_em, fim_em, status),
    KEY idx_encontros_instrutor (instrutor_id, inicio_em),
    KEY idx_encontros_plano (plano_id),
    KEY idx_encontros_fechado_por (fechado_por),
    KEY idx_encontros_criado_por (criado_por),
    CONSTRAINT fk_encontros_oferta FOREIGN KEY (oferta_id)
        REFERENCES atividades_ofertas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_encontros_plano FOREIGN KEY (plano_id)
        REFERENCES planos_aula (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_encontros_instrutor FOREIGN KEY (instrutor_id)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    -- O responsavel pelo fechamento integra o historico do encontro. A conta
    -- deve ser inativada, nao apagada fisicamente; por isso usamos RESTRICT.
    CONSTRAINT fk_encontros_fechador FOREIGN KEY (fechado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_encontros_criador FOREIGN KEY (criado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_encontros_periodo CHECK (fim_em > inicio_em),
    CONSTRAINT ck_encontros_status CHECK (status IN ('AGENDADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TRIGGER IF EXISTS trg_encontros_bi_consistencia;
DROP TRIGGER IF EXISTS trg_encontros_bu_consistencia;

DELIMITER $$

CREATE TRIGGER trg_encontros_bi_consistencia
BEFORE INSERT ON encontros
FOR EACH ROW
BEGIN
    IF NEW.status = 'CONCLUIDO'
       AND (NEW.fechado_por IS NULL OR NEW.fechado_em IS NULL) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Encontro concluido exige usuario e data de fechamento';
    END IF;
END$$

CREATE TRIGGER trg_encontros_bu_consistencia
BEFORE UPDATE ON encontros
FOR EACH ROW
BEGIN
    IF NEW.status = 'CONCLUIDO'
       AND (NEW.fechado_por IS NULL OR NEW.fechado_em IS NULL) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Encontro concluido exige usuario e data de fechamento';
    END IF;
END$$

DELIMITER ;

CREATE TABLE IF NOT EXISTS frequencias (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    encontro_id         BIGINT UNSIGNED NOT NULL,
    matricula_id        BIGINT UNSIGNED NOT NULL,
    status              VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    minutos_creditados  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    justificativa_cifrada LONGBLOB NULL,
    registrado_por      BIGINT UNSIGNED NOT NULL,
    registrado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_por      BIGINT UNSIGNED NULL,
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_frequencias_encontro_mat (encontro_id, matricula_id),
    KEY idx_frequencias_matricula (matricula_id, status),
    KEY idx_frequencias_status (encontro_id, status),
    KEY idx_frequencias_registrador (registrado_por),
    KEY idx_frequencias_atualizador (atualizado_por),
    CONSTRAINT fk_frequencias_encontro FOREIGN KEY (encontro_id)
        REFERENCES encontros (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_frequencias_matricula FOREIGN KEY (matricula_id)
        REFERENCES matriculas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_frequencias_registrador FOREIGN KEY (registrado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_frequencias_atualizador FOREIGN KEY (atualizado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT ck_frequencias_status CHECK (status IN ('PRESENTE', 'AUSENTE', 'JUSTIFICADA', 'NAO_APLICAVEL'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS avaliacoes (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id           CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    componente_id       BIGINT UNSIGNED NOT NULL,
    encontro_id         BIGINT UNSIGNED NULL,
    titulo              VARCHAR(180) NOT NULL,
    tipo                VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    aplicada_em         DATETIME(6) NOT NULL,
    nota_maxima         DECIMAL(7,2) NULL,
    peso                DECIMAL(7,2) NULL,
    observacoes         TEXT NULL,
    status              VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ATIVA',
    criado_por          BIGINT UNSIGNED NOT NULL,
    criado_em           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_avaliacoes_public_id (public_id),
    KEY idx_avaliacoes_comp_data (componente_id, aplicada_em),
    KEY idx_avaliacoes_encontro (encontro_id),
    KEY idx_avaliacoes_criador (criado_por),
    CONSTRAINT fk_avaliacoes_componente FOREIGN KEY (componente_id)
        REFERENCES componentes_curriculares (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacoes_encontro FOREIGN KEY (encontro_id)
        REFERENCES encontros (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_avaliacoes_criador FOREIGN KEY (criado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_avaliacoes_tipo CHECK (tipo IN ('NOTA', 'CONCEITO', 'DIAGNOSTICA', 'FORMATIVA')),
    CONSTRAINT ck_avaliacoes_status CHECK (status IN ('ATIVA', 'FECHADA', 'CANCELADA')),
    CONSTRAINT ck_avaliacoes_nota CHECK (nota_maxima IS NULL OR nota_maxima > 0),
    CONSTRAINT ck_avaliacoes_peso CHECK (peso IS NULL OR peso > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS avaliacoes_resultados (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    avaliacao_id        BIGINT UNSIGNED NOT NULL,
    matricula_id        BIGINT UNSIGNED NOT NULL,
    nota                DECIMAL(7,2) NULL,
    conceito            VARCHAR(30) NULL,
    observacao          TEXT NULL,
    avaliado_por        BIGINT UNSIGNED NOT NULL,
    avaliado_em         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_resultados_avaliacao_mat (avaliacao_id, matricula_id),
    KEY idx_resultados_matricula (matricula_id, avaliacao_id),
    KEY idx_resultados_avaliador (avaliado_por),
    CONSTRAINT fk_resultados_avaliacao FOREIGN KEY (avaliacao_id)
        REFERENCES avaliacoes (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_resultados_matricula FOREIGN KEY (matricula_id)
        REFERENCES matriculas (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_resultados_avaliador FOREIGN KEY (avaliado_por)
        REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_resultados_nota CHECK (nota IS NULL OR nota >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


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


-- ============================================================================
-- NOVO PROJETO APROS - MIGRACAO 005
-- Papeis, permissoes e tipos de documentos/consentimentos
-- Requer: migracoes 001 a 004
-- IMPORTANTE: este arquivo nao cria usuario nem senha padrao.
-- ============================================================================

SET time_zone = '+00:00';
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

INSERT INTO papeis (codigo, nome, descricao, sistema) VALUES
    ('ADMINISTRADOR', 'Administrador', 'Administracao global do sistema.', 1),
    ('COORDENADOR', 'Coordenador', 'Gestao de uma ou mais unidades.', 1),
    ('INSTRUTOR', 'Instrutor', 'Planos, encontros, frequencia e consulta autorizada.', 1),
    ('ATENDIMENTO', 'Atendimento', 'Cadastro e atualizacao cadastral conforme escopo.', 1),
    ('CONSULTA', 'Consulta', 'Acesso somente de leitura a dados nao sensiveis.', 1)
ON DUPLICATE KEY UPDATE
    nome = VALUES(nome),
    descricao = VALUES(descricao),
    sistema = VALUES(sistema);

INSERT INTO permissoes (codigo, modulo, nome, descricao) VALUES
    ('USUARIOS_GERENCIAR', 'SEGURANCA', 'Gerenciar usuarios', 'Criar, bloquear e atribuir papeis.'),
    ('AUDITORIA_VISUALIZAR', 'SEGURANCA', 'Visualizar auditoria', 'Consultar eventos de auditoria permitidos.'),
    ('UNIDADES_GERENCIAR', 'ESTRUTURA', 'Gerenciar unidades', 'Criar e atualizar unidades e programas.'),
    ('PARTICIPANTES_VISUALIZAR', 'PARTICIPANTES', 'Visualizar participantes', 'Consultar dados cadastrais basicos.'),
    ('PARTICIPANTES_CADASTRAR', 'PARTICIPANTES', 'Cadastrar participantes', 'Criar participante e responsaveis.'),
    ('PARTICIPANTES_EDITAR', 'PARTICIPANTES', 'Editar participantes', 'Atualizar dados cadastrais autorizados.'),
    ('DADOS_SENSIVEIS_VISUALIZAR', 'PARTICIPANTES', 'Visualizar dados sensiveis', 'Acessar saude e documentos sensiveis.'),
    ('DADOS_SENSIVEIS_EDITAR', 'PARTICIPANTES', 'Editar dados sensiveis', 'Incluir ou atualizar dados sensiveis.'),
    ('MATRICULAS_GERENCIAR', 'MATRICULAS', 'Gerenciar matriculas', 'Criar, suspender e encerrar matriculas.'),
    ('TRANSFERENCIAS_SOLICITAR', 'MATRICULAS', 'Solicitar transferencia', 'Criar solicitacao de transferencia.'),
    ('TRANSFERENCIAS_APROVAR', 'MATRICULAS', 'Aprovar transferencia', 'Analisar e efetivar transferencias.'),
    ('DOCUMENTOS_VISUALIZAR', 'DOCUMENTOS', 'Visualizar documentos', 'Gerar acesso temporario a documentos.'),
    ('DOCUMENTOS_GERENCIAR', 'DOCUMENTOS', 'Gerenciar documentos', 'Enviar, substituir e revogar documentos.'),
    ('CURRICULO_GERENCIAR', 'PEDAGOGICO', 'Gerenciar curriculo', 'Gerenciar matrizes e componentes.'),
    ('PLANOS_GERENCIAR', 'PEDAGOGICO', 'Gerenciar planos de aula', 'Criar, publicar e arquivar planos.'),
    ('FREQUENCIA_REGISTRAR', 'PEDAGOGICO', 'Registrar frequencia', 'Abrir e fechar chamadas.'),
    ('FREQUENCIA_RELATORIOS', 'PEDAGOGICO', 'Consultar frequencia', 'Visualizar relatorios de frequencia.'),
    ('AVALIACOES_GERENCIAR', 'PEDAGOGICO', 'Gerenciar avaliacoes', 'Criar avaliacoes e registrar resultados.'),
    ('EVENTOS_GERENCIAR', 'EVENTOS', 'Gerenciar eventos', 'Criar eventos e gerenciar participantes.'),
    ('COMUNICACOES_CRIAR', 'COMUNICACAO', 'Criar comunicacao', 'Preparar mensagens e destinatarios.'),
    ('COMUNICACOES_ENVIAR', 'COMUNICACAO', 'Enviar comunicacao', 'Autorizar processamento de filas.'),
    ('CERTIFICADOS_EMITIR', 'CERTIFICADOS', 'Emitir certificados', 'Gerar certificados e links temporarios.'),
    ('CERTIFICADOS_REVOGAR', 'CERTIFICADOS', 'Revogar certificados', 'Revogar certificados com justificativa.'),
    ('VERIFICACOES_ANALISAR', 'CERTIFICADOS', 'Analisar verificacoes', 'Analisar solicitacoes de conferencia cadastral.')
ON DUPLICATE KEY UPDATE
    modulo = VALUES(modulo),
    nome = VALUES(nome),
    descricao = VALUES(descricao);

-- Administrador recebe todas as permissoes atuais. Novas permissoes devem ser
-- vinculadas por uma migracao posterior, nunca por logica apenas no frontend.
INSERT IGNORE INTO papeis_permissoes (papel_id, permissao_id)
SELECT p.id, pe.id
FROM papeis p
CROSS JOIN permissoes pe
WHERE p.codigo = 'ADMINISTRADOR';

-- Coordenador: gestao operacional da unidade, sem administrar contas globais.
INSERT IGNORE INTO papeis_permissoes (papel_id, permissao_id)
SELECT p.id, pe.id
FROM papeis p
JOIN permissoes pe ON pe.codigo IN (
    'PARTICIPANTES_VISUALIZAR', 'PARTICIPANTES_CADASTRAR', 'PARTICIPANTES_EDITAR',
    'DADOS_SENSIVEIS_VISUALIZAR', 'DADOS_SENSIVEIS_EDITAR',
    'MATRICULAS_GERENCIAR', 'TRANSFERENCIAS_SOLICITAR', 'TRANSFERENCIAS_APROVAR',
    'DOCUMENTOS_VISUALIZAR', 'DOCUMENTOS_GERENCIAR',
    'CURRICULO_GERENCIAR', 'PLANOS_GERENCIAR',
    'FREQUENCIA_REGISTRAR', 'FREQUENCIA_RELATORIOS', 'AVALIACOES_GERENCIAR',
    'EVENTOS_GERENCIAR', 'COMUNICACOES_CRIAR', 'COMUNICACOES_ENVIAR',
    'CERTIFICADOS_EMITIR', 'CERTIFICADOS_REVOGAR', 'VERIFICACOES_ANALISAR'
)
WHERE p.codigo = 'COORDENADOR';

INSERT IGNORE INTO papeis_permissoes (papel_id, permissao_id)
SELECT p.id, pe.id
FROM papeis p
JOIN permissoes pe ON pe.codigo IN (
    'PARTICIPANTES_VISUALIZAR', 'PLANOS_GERENCIAR',
    'FREQUENCIA_REGISTRAR', 'FREQUENCIA_RELATORIOS', 'AVALIACOES_GERENCIAR',
    'EVENTOS_GERENCIAR'
)
WHERE p.codigo = 'INSTRUTOR';

INSERT IGNORE INTO papeis_permissoes (papel_id, permissao_id)
SELECT p.id, pe.id
FROM papeis p
JOIN permissoes pe ON pe.codigo IN (
    'PARTICIPANTES_VISUALIZAR', 'PARTICIPANTES_CADASTRAR', 'PARTICIPANTES_EDITAR',
    'MATRICULAS_GERENCIAR', 'TRANSFERENCIAS_SOLICITAR',
    'DOCUMENTOS_VISUALIZAR', 'DOCUMENTOS_GERENCIAR'
)
WHERE p.codigo = 'ATENDIMENTO';

INSERT IGNORE INTO papeis_permissoes (papel_id, permissao_id)
SELECT p.id, pe.id
FROM papeis p
JOIN permissoes pe ON pe.codigo IN ('PARTICIPANTES_VISUALIZAR', 'FREQUENCIA_RELATORIOS')
WHERE p.codigo = 'CONSULTA';

INSERT INTO consentimentos_tipos (codigo, nome, descricao, exige_responsavel, ativo) VALUES
    ('TRATAMENTO_DADOS', 'Tratamento de dados pessoais', 'Registro da base e finalidade do tratamento.', 1, 1),
    ('USO_IMAGEM', 'Uso de imagem', 'Autorizacao especifica para uso de imagem.', 1, 1),
    ('SAIDA_DESACOMPANHADA', 'Saida desacompanhada', 'Autorizacao para o participante sair desacompanhado.', 1, 1),
    ('PARTICIPACAO_EVENTO', 'Participacao em evento', 'Autorizacao vinculada a evento externo.', 1, 1),
    ('COMUNICACAO_WHATSAPP', 'Comunicacao por WhatsApp', 'Consentimento para comunicacoes pelo canal.', 1, 1)
ON DUPLICATE KEY UPDATE
    nome = VALUES(nome),
    descricao = VALUES(descricao),
    exige_responsavel = VALUES(exige_responsavel),
    ativo = VALUES(ativo);

INSERT INTO documentos_tipos (codigo, nome, contem_dado_sensivel, validade_meses, ativo) VALUES
    ('FOTO_PERFIL', 'Foto de identificacao', 1, NULL, 1),
    ('CERTIDAO_NASCIMENTO', 'Certidao de nascimento', 1, NULL, 1),
    ('DOCUMENTO_RESPONSAVEL', 'Documento do responsavel', 1, NULL, 1),
    ('COMPROVANTE_RESIDENCIA', 'Comprovante de residencia', 1, 6, 1),
    ('ATESTADO_SAUDE', 'Atestado de saude', 1, 12, 1),
    ('CARTAO_VACINA', 'Cartao de vacina', 1, NULL, 1),
    ('DECLARACAO_ESCOLAR', 'Declaracao escolar', 1, 12, 1),
    ('TERMO_ASSINADO', 'Termo ou autorizacao assinada', 1, NULL, 1)
ON DUPLICATE KEY UPDATE
    nome = VALUES(nome),
    contem_dado_sensivel = VALUES(contem_dado_sensivel),
    validade_meses = VALUES(validade_meses),
    ativo = VALUES(ativo);


-- ============================================================================
-- NOVO PROJETO APROS - MIGRACAO 006
-- Views operacionais sem CPF, telefone, endereco ou dados de saude
-- Requer: migracoes 001 a 005
-- ============================================================================

SET time_zone = '+00:00';
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

CREATE OR REPLACE SQL SECURITY INVOKER VIEW vw_matriculas_ativas AS
SELECT
    m.public_id AS matricula_public_id,
    m.numero AS matricula_numero,
    p.public_id AS participante_public_id,
    pe.nome AS participante_nome,
    pr.codigo AS programa_codigo,
    pr.nome AS programa_nome,
    u.public_id AS unidade_public_id,
    u.codigo AS unidade_codigo,
    u.nome AS unidade_nome,
    t.public_id AS turma_public_id,
    t.nome AS turma_nome,
    t.turno_codigo,
    mv.data_inicio AS vinculo_desde,
    m.status AS matricula_status
FROM matriculas m
JOIN participantes p ON p.id = m.participante_id
JOIN pessoas pe ON pe.id = p.pessoa_id
JOIN programas pr ON pr.id = m.programa_id
JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id
JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id AND mv.matricula_id = m.id
JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id
JOIN unidades u ON u.id = pu.unidade_id
LEFT JOIN turmas t ON t.id = mv.turma_id
WHERE m.status = 'ATIVA'
  AND p.ativo = 1
  AND pe.excluido_em IS NULL;

CREATE OR REPLACE SQL SECURITY INVOKER VIEW vw_frequencia_resumo AS
SELECT
    f.matricula_id,
    COUNT(*) AS total_registros,
    SUM(f.status = 'PRESENTE') AS total_presentes,
    SUM(f.status = 'AUSENTE') AS total_ausentes,
    SUM(f.status = 'JUSTIFICADA') AS total_justificadas,
    SUM(f.minutos_creditados) AS minutos_creditados,
    ROUND(
        100 * SUM(f.status = 'PRESENTE') /
        NULLIF(SUM(f.status IN ('PRESENTE', 'AUSENTE', 'JUSTIFICADA')), 0),
        2
    ) AS percentual_presenca
FROM frequencias f
GROUP BY f.matricula_id;

CREATE OR REPLACE SQL SECURITY INVOKER VIEW vw_transferencias_pendentes AS
SELECT
    mt.public_id AS transferencia_public_id,
    mt.status,
    mt.solicitada_em,
    m.public_id AS matricula_public_id,
    m.numero AS matricula_numero,
    pe.nome AS participante_nome,
    uo.nome AS unidade_origem,
    ud.nome AS unidade_destino,
    mt.motivo
FROM matriculas_transferencias mt
JOIN matriculas m ON m.id = mt.matricula_id
JOIN participantes p ON p.id = m.participante_id
JOIN pessoas pe ON pe.id = p.pessoa_id
JOIN matriculas_vinculos mvo ON mvo.id = mt.origem_vinculo_id
JOIN programas_unidades puo ON puo.id = mvo.programa_unidade_id
JOIN unidades uo ON uo.id = puo.unidade_id
JOIN programas_unidades pud ON pud.id = mt.destino_programa_unidade_id
JOIN unidades ud ON ud.id = pud.unidade_id
WHERE mt.status IN ('SOLICITADA', 'APROVADA');

CREATE OR REPLACE SQL SECURITY INVOKER VIEW vw_comunicacoes_resumo AS
SELECT
    cf.public_id AS fila_public_id,
    cf.titulo,
    cf.canal,
    cf.status,
    cf.agendada_para,
    cf.criado_em,
    COUNT(cd.id) AS total_itens,
    SUM(cd.status = 'PENDENTE') AS pendentes,
    SUM(cd.status IN ('ENVIADA', 'ENTREGUE', 'LIDA')) AS enviados,
    SUM(cd.status = 'FALHOU') AS falhas,
    SUM(cd.status = 'BLOQUEADA') AS bloqueados
FROM comunicacoes_filas cf
LEFT JOIN comunicacoes_destinatarios cd ON cd.fila_id = cf.id
GROUP BY cf.id, cf.public_id, cf.titulo, cf.canal, cf.status, cf.agendada_para, cf.criado_em;

-- ============================================================================
-- NOVO PROJETO APROS - MIGRACAO 007
-- Snapshots imutaveis para certificados
-- Requer: migracoes 001 a 006
-- Compatibilidade: MySQL 8.0.16+ e MariaDB 10.6+
-- ============================================================================

SET time_zone = '+00:00';
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- O procedimento torna a adicao das colunas repetivel. Os dados impressos no
-- certificado deixam de mudar quando o participante e transferido ou quando
-- nomes cadastrais sao atualizados.
DROP PROCEDURE IF EXISTS apros_migrar_007_certificados;

DELIMITER $$

CREATE PROCEDURE apros_migrar_007_certificados()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'certificados'
          AND COLUMN_NAME = 'participante_nome_snapshot'
    ) THEN
        ALTER TABLE certificados
            ADD COLUMN participante_nome_snapshot VARCHAR(180) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'certificados'
          AND COLUMN_NAME = 'matricula_numero_snapshot'
    ) THEN
        ALTER TABLE certificados
            ADD COLUMN matricula_numero_snapshot VARCHAR(30)
            CHARACTER SET ascii COLLATE ascii_bin NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'certificados'
          AND COLUMN_NAME = 'programa_nome_snapshot'
    ) THEN
        ALTER TABLE certificados
            ADD COLUMN programa_nome_snapshot VARCHAR(150) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'certificados'
          AND COLUMN_NAME = 'unidade_nome_snapshot'
    ) THEN
        ALTER TABLE certificados
            ADD COLUMN unidade_nome_snapshot VARCHAR(180) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'certificados'
          AND COLUMN_NAME = 'componente_nome_snapshot'
    ) THEN
        ALTER TABLE certificados
            ADD COLUMN componente_nome_snapshot VARCHAR(180) NULL;
    END IF;

    UPDATE certificados c
    JOIN matriculas m ON m.id = c.matricula_id
    JOIN participantes pt ON pt.id = m.participante_id
    JOIN pessoas pe ON pe.id = pt.pessoa_id
    JOIN programas pr ON pr.id = m.programa_id
    LEFT JOIN componentes_curriculares cc ON cc.id = c.componente_id
    LEFT JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id
    LEFT JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id
    LEFT JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id
    LEFT JOIN unidades u ON u.id = pu.unidade_id
    SET c.participante_nome_snapshot = COALESCE(c.participante_nome_snapshot, pe.nome),
        c.matricula_numero_snapshot = COALESCE(c.matricula_numero_snapshot, m.numero),
        c.programa_nome_snapshot = COALESCE(c.programa_nome_snapshot, pr.nome),
        c.unidade_nome_snapshot = COALESCE(c.unidade_nome_snapshot, u.nome, 'Unidade nao informada'),
        c.componente_nome_snapshot = COALESCE(c.componente_nome_snapshot, cc.nome);

    ALTER TABLE certificados
        MODIFY COLUMN participante_nome_snapshot VARCHAR(180) NOT NULL,
        MODIFY COLUMN matricula_numero_snapshot VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        MODIFY COLUMN programa_nome_snapshot VARCHAR(150) NOT NULL,
        MODIFY COLUMN unidade_nome_snapshot VARCHAR(180) NOT NULL;
END$$

DELIMITER ;

CALL apros_migrar_007_certificados();
DROP PROCEDURE apros_migrar_007_certificados;
