import {
  CancelOwnRegistrationParams,
  CancelOwnRegistrationResponse,
  GetRegistrationBadgeParams,
  GetRegistrationBadgeResponse,
  RegisterForEventBody,
  RegisterForEventParams,
  RegisterForEventResponse,
} from "@workspace/api-zod";
import { db, eventsTable, registrationsTable } from "@workspace/db";
import { and, eq, ne } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { randomInt } from "node:crypto";
import { toEventResponse } from "../lib/event-utils";
import { rateLimit } from "../middlewares/rateLimit";

const router: IRouter = Router();
const registrationRateLimit = rateLimit({
  limit: 6,
  windowMs: 60 * 60 * 1000,
  message: "Trop de tentatives d'inscription. Réessayez plus tard.",
});
const lookupRateLimit = rateLimit({
  limit: 12,
  windowMs: 10 * 60 * 1000,
  message: "Trop de recherches de badge. Réessayez dans quelques minutes.",
});

router.post(
  "/events/:eventId/registrations",
  registrationRateLimit,
  async (req, res): Promise<void> => {
    const params = RegisterForEventParams.safeParse(req.params);
    const input = RegisterForEventBody.safeParse(req.body);
    if (!params.success || !input.success) {
      res.status(400).json({ error: "Vérifiez les champs du formulaire." });
      return;
    }

    const fullName = input.data.fullName.trim().replace(/\s+/g, " ");
    const className = input.data.className.trim().replace(/\s+/g, " ");
    if (fullName.length < 2 || className.length < 1) {
      res.status(400).json({ error: "Le nom et la classe sont obligatoires." });
      return;
    }
    const nameKey = fullName.toLocaleLowerCase();
    const classKey = className.toLocaleLowerCase();

    const result = await db.transaction(async (tx) => {
      const [event] = await tx
        .select()
        .from(eventsTable)
        .where(eq(eventsTable.id, params.data.eventId))
        .for("update")
        .limit(1);

      if (!event) return { kind: "not-found" as const };
      if (!event.isOpen) return { kind: "closed" as const };
      if (event.registeredCount >= event.maxCapacity) {
        return { kind: "full" as const };
      }

      const [duplicate] = await tx
        .select({ id: registrationsTable.id })
        .from(registrationsTable)
        .where(
          and(
            eq(registrationsTable.eventId, event.id),
            eq(registrationsTable.nameKey, nameKey),
            eq(registrationsTable.classKey, classKey),
            ne(registrationsTable.status, "cancelled"),
          ),
        )
        .limit(1);
      if (duplicate) return { kind: "duplicate" as const };

      const [created] = await tx
        .insert(registrationsTable)
        .values({
          eventId: event.id,
          registrationNumber: `MC-${String(randomInt(0, 1_000_000_000_000)).padStart(12, "0")}`,
          fullName,
          className,
          nameKey,
          classKey,
          status: "registered",
          consentedAt: new Date(),
        })
        .returning();

      await tx
        .update(eventsTable)
        .set({ registeredCount: event.registeredCount + 1 })
        .where(eq(eventsTable.id, event.id));

      return {
        kind: "created" as const,
        registration: created,
        event: { ...event, registeredCount: event.registeredCount + 1 },
      };
    });

    if (result.kind === "not-found") {
      res.status(404).json({ error: "Événement introuvable." });
      return;
    }
    if (result.kind === "closed") {
      res.status(409).json({ error: "Les inscriptions sont fermées." });
      return;
    }
    if (result.kind === "full") {
      res.status(409).json({ error: "Complet" });
      return;
    }
    if (result.kind === "duplicate") {
      res.status(409).json({ error: "Une inscription existe déjà pour ce nom et cette classe." });
      return;
    }

    res.status(201).json(
      RegisterForEventResponse.parse({
        registrationNumber: result.registration.registrationNumber,
        fullName: result.registration.fullName,
        className: result.registration.className,
        status: result.registration.status,
        event: toEventResponse(result.event),
      }),
    );
  },
);

router.get(
  "/registrations/:registrationNumber",
  lookupRateLimit,
  async (req, res): Promise<void> => {
    const params = GetRegistrationBadgeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Numéro de badge invalide." });
      return;
    }

    const [registration] = await db
      .select()
      .from(registrationsTable)
      .where(eq(registrationsTable.registrationNumber, params.data.registrationNumber))
      .limit(1);
    if (!registration) {
      res.status(404).json({ error: "Badge introuvable." });
      return;
    }

    const [event] = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.id, registration.eventId))
      .limit(1);
    if (!event) {
      res.status(404).json({ error: "Événement introuvable." });
      return;
    }

    res.json(
      GetRegistrationBadgeResponse.parse({
        registrationNumber: registration.registrationNumber,
        fullName: registration.fullName,
        className: registration.className,
        status: registration.status,
        event: toEventResponse(event),
      }),
    );
  },
);

router.delete(
  "/registrations/:registrationNumber",
  lookupRateLimit,
  async (req, res): Promise<void> => {
    const params = CancelOwnRegistrationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Numéro de badge invalide." });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [registration] = await tx
        .select()
        .from(registrationsTable)
        .where(eq(registrationsTable.registrationNumber, params.data.registrationNumber))
        .for("update")
        .limit(1);
      if (!registration) return { kind: "not-found" as const };
      if (registration.status === "cancelled") {
        return { kind: "cancelled" as const };
      }

      const [event] = await tx
        .select()
        .from(eventsTable)
        .where(eq(eventsTable.id, registration.eventId))
        .for("update")
        .limit(1);
      if (!event) return { kind: "not-found" as const };

      await tx
        .update(registrationsTable)
        .set({ status: "cancelled" })
        .where(eq(registrationsTable.id, registration.id));
      await tx
        .update(eventsTable)
        .set({
          registeredCount: Math.max(0, event.registeredCount - 1),
          presentCount:
            registration.status === "present"
              ? Math.max(0, event.presentCount - 1)
              : event.presentCount,
        })
        .where(eq(eventsTable.id, event.id));
      return { kind: "cancelled-now" as const };
    });

    if (result.kind === "not-found") {
      res.status(404).json({ error: "Badge introuvable." });
      return;
    }
    if (result.kind === "cancelled") {
      res.status(409).json({ error: "Cette inscription est déjà annulée." });
      return;
    }
    res.json(CancelOwnRegistrationResponse.parse({ success: true }));
  },
);

export default router;
