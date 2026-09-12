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
