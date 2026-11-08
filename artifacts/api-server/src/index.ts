import app from "./app";
import { cleanExpiredRegistrationData } from "./lib/retention";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

const runRetentionCleanup = (): void => {
  void cleanExpiredRegistrationData().catch((err: unknown) => {
    logger.error({ err }, "Registration data retention cleanup failed");
  });
};
runRetentionCleanup();
const retentionTimer = setInterval(runRetentionCleanup, 6 * 60 * 60 * 1000);
retentionTimer.unref();
