import {
  GetEventParams,
  GetEventResponse,
  GetUpcomingEventResponse,
  ListActivitiesResponse,
  ListEventsResponse,
  ListPublicArchiveResponse,
} from "@workspace/api-zod";
import { db, eventsTable } from "@workspace/db";
import { asc, eq, gte, lt } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { toEventResponse, getSchoolDate } from "../lib/event-utils";

const router: IRouter = Router();

router.get("/events/upcoming", async (_req, res): Promise<void> => {
  const [event] = await db
    .select()
    .from(eventsTable)
    .where(gte(eventsTable.date, getSchoolDate()))
    .orderBy(asc(eventsTable.date), asc(eventsTable.id))
    .limit(1);
  res.json(GetUpcomingEventResponse.parse({ event: event ? toEventResponse(event) : null }));
});

router.get("/events", async (_req, res): Promise<void> => {
  const events = await db
    .select()
    .from(eventsTable)
    .where(gte(eventsTable.date, getSchoolDate()))
    .orderBy(asc(eventsTable.date), asc(eventsTable.id));
  res.json(ListEventsResponse.parse(events.map(toEventResponse)));
});

router.get("/events/archive", async (_req, res): Promise<void> => {
  const events = await db
    .select({
      id: eventsTable.id,
      title: eventsTable.title,
      date: eventsTable.date,
    })
    .from(eventsTable)
    .where(lt(eventsTable.date, getSchoolDate()))
    .orderBy(asc(eventsTable.date));
  res.json(ListPublicArchiveResponse.parse(events));
});

router.get("/events/:eventId", async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
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
  res.json(GetEventResponse.parse(toEventResponse(event)));
});

router.get("/activities", (_req, res): void => {
  res.json(
    ListActivitiesResponse.parse([
      {
        id: "culture",
        title: "Activités culturelles",
        description: "Rencontres, lectures et découvertes autour de la culture.",
        schedule: "Programme à confirmer",
      },
      {
        id: "clubs",
        title: "Clubs et ateliers",
        description: "Des idées à partager et des projets à construire ensemble.",
        schedule: "Horaires communiqués prochainement",
      },
      {
        id: "sport",
        title: "Activités sportives",
        description: "Des moments pour bouger, jouer et participer en équipe.",
        schedule: "Planning à confirmer",
      },
    ]),
  );
});

export default router;
