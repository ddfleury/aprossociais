import { processMessageQueue } from "../src/modules/communications/processor";
import { getPool } from "../src/core/db/pool";

try {
  const result = await processMessageQueue({ limit: 100 });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.configurationMissing ? 2 : 0;
} catch (error) {
  console.error(
    "Falha ao processar a fila:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  await getPool().end();
}
