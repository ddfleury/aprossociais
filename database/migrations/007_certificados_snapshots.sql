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
