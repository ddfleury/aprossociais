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
