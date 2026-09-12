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
