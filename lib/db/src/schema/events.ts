import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 120 }).notNull(),
  description: text("description").notNull().default(""),
  date: date("date", { mode: "string" }).notNull(),
  time: varchar("time", { length: 30 }).notNull(),
  place: varchar("place", { length: 160 }).notNull(),
  maxCapacity: integer("max_capacity").notNull(),
  registeredCount: integer("registered_count").notNull().default(0),
  presentCount: integer("present_count").notNull().default(0),
  isOpen: boolean("is_open").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const registrationsTable = pgTable(
  "event_registrations",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    registrationNumber: varchar("registration_number", { length: 24 })
      .notNull()
      .unique(),
    fullName: varchar("full_name", { length: 100 }).notNull(),
    className: varchar("class_name", { length: 40 }).notNull(),
    nameKey: varchar("name_key", { length: 100 }).notNull(),
    classKey: varchar("class_key", { length: 40 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("registered"),
    consentedAt: timestamp("consented_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("event_registrations_event_idx").on(table.eventId),
    index("event_registrations_number_idx").on(table.registrationNumber),
    uniqueIndex("event_registrations_active_duplicate_idx")
      .on(table.eventId, table.nameKey, table.classKey)
      .where(sql`${table.status} <> 'cancelled'`),
  ],
);

export const insertEventSchema = createInsertSchema(eventsTable).omit({
  id: true,
  registeredCount: true,
  presentCount: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
export type Registration = typeof registrationsTable.$inferSelect;
