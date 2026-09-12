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
