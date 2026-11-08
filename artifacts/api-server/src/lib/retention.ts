import { appSettingsTable, db } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

export async function cleanExpiredRegistrationData(): Promise<void> {
  const [current] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, 1))
    .limit(1);
  let retentionMonths = current?.retentionMonths ?? 6;

  if (!current) {
    const [created] = await db
      .insert(appSettingsTable)
      .values({ id: 1, retentionMonths: 6 })
      .onConflictDoNothing()
      .returning();
    if (!created) {
      const [afterConflict] = await db
        .select()
        .from(appSettingsTable)
        .where(eq(appSettingsTable.id, 1))
        .limit(1);
      retentionMonths = afterConflict?.retentionMonths ?? 6;
    }
  }

  const result = await db.execute(sql`
    DELETE FROM event_registrations AS registration
    USING events AS event
    WHERE registration.event_id = event.id
      AND event.date < CURRENT_DATE - make_interval(months => ${retentionMonths})
  `);
  const rowCount = "rowCount" in result ? result.rowCount : 0;
  if (rowCount && rowCount > 0) {
    logger.info({ deletedRegistrationRows: rowCount }, "Expired registration data removed");
  }
}
