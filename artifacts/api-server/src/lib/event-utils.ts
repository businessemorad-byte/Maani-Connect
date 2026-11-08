import type { Event } from "@workspace/db";

export function toEventResponse(event: Event) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    date: event.date,
    time: event.time,
    place: event.place,
    maxCapacity: event.maxCapacity,
    registeredCount: event.registeredCount,
    spotsLeft: Math.max(0, event.maxCapacity - event.registeredCount),
    isOpen: event.isOpen,
  };
}

export function toAdminEventResponse(event: Event) {
  return {
    ...toEventResponse(event),
    presentCount: event.presentCount,
    updatedAt: event.updatedAt.toISOString(),
  };
}

export function getSchoolDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
