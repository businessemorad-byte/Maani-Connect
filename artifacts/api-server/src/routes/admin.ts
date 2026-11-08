import {
  CreateEventBody,
  CreateEventResponse,
  ExportEventRegistrationsParams,
  GetAdminSettingsResponse,
  ListAdminArchiveResponse,
  ListAdminEventsResponse,
  ListEventRegistrationsParams,
  ListEventRegistrationsResponse,
  UpdateAdminSettingsBody,
  UpdateAdminSettingsResponse,
  UpdateEventBody,
  UpdateEventParams,
  UpdateEventResponse,
  UpdateRegistrationStatusBody,
  UpdateRegistrationStatusParams,
  UpdateRegistrationStatusResponse,
} from "@workspace/api-zod";
import {
  appSettingsTable,
  db,
  eventsTable,
  registrationsTable,
} from "@workspace/db";
import { and, asc, eq, ilike, lt, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { toAdminEventResponse, getSchoolDate } from "../lib/event-utils";
import { requireAdmin } from "../middlewares/adminAuth";

const router: IRouter = Router();
router.use("/admin", requireAdmin);

async function getOrCreateSettings() {
  const [existing] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, 1))
    .limit(1);
  if (existing) return existing;

  await db
    .insert(appSettingsTable)
    .values({ id: 1, retentionMonths: 6 })
    .onConflictDoNothing();
  const [created] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, 1))
    .limit(1);
  return created;
}

function csvCell(value: string): string {
  const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

router.get("/admin/events", async (_req, res): Promise<void> => {
  const events = await db
    .select()
    .from(eventsTable)
    .orderBy(asc(eventsTable.date), asc(eventsTable.id));
  res.json(ListAdminEventsResponse.parse(events.map(toAdminEventResponse)));
});

router.post("/admin/events", async (req, res): Promise<void> => {
  const input = CreateEventBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Vérifiez les informations de l'événement." });
    return;
  }
  const values = {
    ...input.data,
    title: input.data.title.trim(),
    description: input.data.description.trim(),
    time: input.data.time.trim(),
    place: input.data.place.trim(),
  };
  if (!values.title || !values.place || !values.time) {
    res.status(400).json({ error: "Le titre, l'horaire et le lieu sont obligatoires." });
    return;
  }

  const [event] = await db.insert(eventsTable).values(values).returning();
  res.status(201).json(CreateEventResponse.parse(toAdminEventResponse(event)));
});

router.patch("/admin/events/:eventId", async (req, res): Promise<void> => {
  const params = UpdateEventParams.safeParse(req.params);
  const input = UpdateEventBody.safeParse(req.body);
  if (!params.success || !input.success) {
    res.status(400).json({ error: "Vérifiez les informations de l'événement." });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [event] = await tx
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.id, params.data.eventId))
      .for("update")
      .limit(1);
    if (!event) return { kind: "not-found" as const };

    if (
      input.data.maxCapacity !== undefined &&
      input.data.maxCapacity < event.registeredCount
    ) {
      return { kind: "capacity-too-low" as const };
    }

    const update = {
      ...input.data,
      ...(input.data.title !== undefined
        ? { title: input.data.title.trim() }
        : {}),
      ...(input.data.description !== undefined
        ? { description: input.data.description.trim() }
        : {}),
      ...(input.data.time !== undefined ? { time: input.data.time.trim() } : {}),
      ...(input.data.place !== undefined ? { place: input.data.place.trim() } : {}),
      updatedAt: new Date(),
    };
    if (
      update.title === "" ||
      update.time === "" ||
      update.place === ""
    ) {
      return { kind: "invalid" as const };
    }
    const [updated] = await tx
      .update(eventsTable)
      .set(update)
      .where(eq(eventsTable.id, event.id))
      .returning();
    return { kind: "updated" as const, event: updated };
  });

  if (result.kind === "not-found") {
    res.status(404).json({ error: "Événement introuvable." });
    return;
  }
  if (result.kind === "capacity-too-low") {
    res.status(400).json({
      error: "La capacité ne peut pas être inférieure au nombre d'inscriptions actives.",
    });
    return;
  }
  if (result.kind === "invalid") {
    res.status(400).json({ error: "Le titre, l'horaire et le lieu sont obligatoires." });
    return;
  }
  res.json(UpdateEventResponse.parse(toAdminEventResponse(result.event)));
});

router.get(
  "/admin/events/:eventId/registrations",
  async (req, res): Promise<void> => {
    const params = ListEventRegistrationsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Identifiant d'événement invalide." });
      return;
    }

    const registrations = await db
      .select({
        registrationNumber: registrationsTable.registrationNumber,
        fullName: registrationsTable.fullName,
        className: registrationsTable.className,
        status: registrationsTable.status,
        createdAt: registrationsTable.createdAt,
      })
      .from(registrationsTable)
      .where(eq(registrationsTable.eventId, params.data.eventId))
      .orderBy(asc(registrationsTable.createdAt));
    const records = registrations
      .filter((row) => row.registrationNumber !== null)
      .map((row) => ({ ...row, registrationNumber: row.registrationNumber! }));
    res.json(
      ListEventRegistrationsResponse.parse(
        records.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      ),
    );
  },
);

router.patch(
  "/admin/registrations/:registrationNumber/status",
  async (req, res): Promise<void> => {
    const params = UpdateRegistrationStatusParams.safeParse(req.params);
    const input = UpdateRegistrationStatusBody.safeParse(req.body);
    if (!params.success || !input.success) {
      res.status(400).json({ error: "Statut ou numéro de badge invalide." });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [registration] = await tx
        .select()
        .from(registrationsTable)
        .where(
          eq(registrationsTable.registrationNumber, params.data.registrationNumber),
        )
        .for("update")
        .limit(1);
      if (!registration) return { kind: "not-found" as const };

      const [event] = await tx
        .select()
        .from(eventsTable)
        .where(eq(eventsTable.id, registration.eventId))
        .for("update")
        .limit(1);
      if (!event) return { kind: "not-found" as const };
      if (
        registration.status === "cancelled" &&
        input.data.status === "present"
      ) {
        return { kind: "cancelled" as const };
      }

      let registeredCount = event.registeredCount;
      let presentCount = event.presentCount;
      if (
        input.data.status === "cancelled" &&
        registration.status !== "cancelled"
      ) {
        registeredCount = Math.max(0, registeredCount - 1);
        if (registration.status === "present") {
          presentCount = Math.max(0, presentCount - 1);
        }
      } else if (
        input.data.status === "present" &&
        registration.status === "registered"
      ) {
        presentCount += 1;
      }

      const [updated] = await tx
        .update(registrationsTable)
        .set({ status: input.data.status })
        .where(eq(registrationsTable.id, registration.id))
        .returning();
      await tx
        .update(eventsTable)
        .set({ registeredCount, presentCount })
        .where(eq(eventsTable.id, event.id));
      return { kind: "updated" as const, registration: updated };
    });

    if (result.kind === "not-found") {
      res.status(404).json({ error: "Badge introuvable." });
      return;
    }
    if (result.kind === "cancelled") {
      res.status(409).json({ error: "Une inscription annulée ne peut pas être marquée présente." });
      return;
    }
    if (!result.registration.registrationNumber) {
      res.status(500).json({ error: "Numéro de badge manquant." });
      return;
    }
    res.json(
      UpdateRegistrationStatusResponse.parse({
        registrationNumber: result.registration.registrationNumber,
        fullName: result.registration.fullName,
        className: result.registration.className,
        status: result.registration.status,
        createdAt: result.registration.createdAt.toISOString(),
      }),
    );
  },
);

router.get(
  "/admin/events/:eventId/export.csv",
  async (req, res): Promise<void> => {
    const params = ExportEventRegistrationsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Identifiant d'événement invalide." });
      return;
    }
    const [event] = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.id, params.data.eventId))
      .limit(1);
    if (!event) {
      res.status(404).json({ error: "Événement introuvable." });
      return;
    }
    const registrations = await db
      .select()
      .from(registrationsTable)
      .where(eq(registrationsTable.eventId, event.id))
      .orderBy(asc(registrationsTable.createdAt));
    const rows = [
      ["Numéro", "Nom complet", "Classe", "Statut", "Date d'inscription"],
      ...registrations
        .filter((row) => row.registrationNumber !== null)
        .map((row) => [
          row.registrationNumber!,
          row.fullName,
          row.className,
          row.status,
          row.createdAt.toISOString(),
        ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    res
      .status(200)
      .type("text/csv; charset=utf-8")
      .setHeader(
        "Content-Disposition",
        `attachment; filename="maani-event-${event.id}-inscrits.csv"`,
      )
      .send(csv);
  },
);

router.get("/admin/archive", async (_req, res): Promise<void> => {
  const events = await db
    .select({
      id: eventsTable.id,
      title: eventsTable.title,
      date: eventsTable.date,
      registeredCount: eventsTable.registeredCount,
      presentCount: eventsTable.presentCount,
    })
    .from(eventsTable)
    .orderBy(asc(eventsTable.date));
  res.json(ListAdminArchiveResponse.parse(events));
});

router.get("/admin/settings", async (_req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  res.json(
    GetAdminSettingsResponse.parse({
      retentionMonths: settings.retentionMonths,
    }),
  );
});

router.put("/admin/settings", async (req, res): Promise<void> => {
  const input = UpdateAdminSettingsBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "La durée doit être comprise entre 1 et 60 mois." });
    return;
  }
  const [settings] = await db
    .insert(appSettingsTable)
    .values({ id: 1, retentionMonths: input.data.retentionMonths })
    .onConflictDoUpdate({
      target: appSettingsTable.id,
      set: {
        retentionMonths: input.data.retentionMonths,
        updatedAt: new Date(),
      },
    })
    .returning();
  res.json(
    UpdateAdminSettingsResponse.parse({
      retentionMonths: settings.retentionMonths,
    }),
  );
});

export default router;
