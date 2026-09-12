import { getPool, queryRows, type RowDataPacket } from "../src/core/db/pool";

const REQUIRED_TABLES = [
  "auditoria_eventos",
  "certificados",
  "comunicacoes_filas",
  "comunicacoes_destinatarios",
  "consentimentos",
  "consentimentos_tipos",
  "documentos",
  "encontros",
  "eventos",
  "frequencias",
  "matriculas",
  "matriculas_transferencias",
  "matriculas_vinculo_atual",
  "participantes",
  "participantes_responsaveis",
  "participantes_responsavel_principal",
  "pessoas",
  "pessoas_contatos",
  "programas",
  "programas_unidades",
  "turmas",
  "unidades",
  "usuarios",
  "usuarios_sessoes",
] as const;

type TableRow = RowDataPacket & { table_name: string };
type ColumnRow = RowDataPacket & { column_name: string };
type VersionRow = RowDataPacket & { version: string };

try {
  const [version] = await queryRows<VersionRow>("SELECT VERSION() AS version");
  const [rows, certificateColumns] = await Promise.all([
    queryRows<TableRow>(
      `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name IN (${REQUIRED_TABLES.map(() => "?").join(",")})`,
      REQUIRED_TABLES,
    ),
    queryRows<ColumnRow>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'certificados'
          AND column_name IN ('participante_nome_snapshot', 'matricula_numero_snapshot', 'programa_nome_snapshot', 'unidade_nome_snapshot')`,
    ),
  ]);
  const available = new Set(rows.map((row) => row.table_name));
  const missing = REQUIRED_TABLES.filter((table) => !available.has(table));
  console.log(`Servidor: ${version?.version ?? "não identificado"}`);
  console.log(
    `Tabelas essenciais: ${REQUIRED_TABLES.length - missing.length}/${REQUIRED_TABLES.length}`,
  );
  const missingCertificateSnapshots = certificateColumns.length < 4;
  if (missing.length || missingCertificateSnapshots) {
    if (missing.length) console.error(`Ausentes: ${missing.join(", ")}`);
    if (missingCertificateSnapshots)
      console.error(
        "Migração 007 de snapshots dos certificados não foi aplicada.",
      );
    process.exitCode = 1;
  } else {
    console.log("Estrutura essencial disponível.");
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Falha ao verificar o banco.",
  );
  process.exitCode = 1;
} finally {
  await getPool().end();
}
