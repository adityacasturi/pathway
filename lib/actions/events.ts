"use server";

import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { deriveStatus } from "@/lib/config/events";
import { revalidatePath } from "next/cache";
import { ApplicationEvent, EventType, Status } from "@/types/application";

const EVENT_TYPES: readonly EventType[] = ["applied", "oa", "interview", "offer", "rejected", "note"];
const MAX_NOTES_LENGTH = 2000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_APPLIED_EVENT_RE = /^local-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-applied$/i;

function revalidateApplicationSurfaces() {
  revalidatePath("/");
  revalidatePath("/applications");
  revalidatePath("/stats");
}

function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function getLocalAppliedApplicationId(eventId: string): string | null {
  return eventId.match(LOCAL_APPLIED_EVENT_RE)?.[1] ?? null;
}

function isIsoDate(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw;
}

async function ensureOwnsApplication(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"],
  userId: string,
  applicationId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

async function getOwnedEvent(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"],
  userId: string,
  eventId: string,
  applicationId?: string,
): Promise<Pick<ApplicationEvent, "id" | "application_id" | "event_type"> | null> {
  let query = supabase
    .from("application_events")
    .select("id, application_id, event_type")
    .eq("id", eventId)
    .eq("user_id", userId);

  if (applicationId) query = query.eq("application_id", applicationId);

  const { data } = await query.maybeSingle();
  return (data as Pick<ApplicationEvent, "id" | "application_id" | "event_type"> | null) ?? null;
}

async function getOwnedAppliedEvent(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"],
  userId: string,
  applicationId: string,
): Promise<Pick<ApplicationEvent, "id" | "application_id" | "event_type"> | null> {
  const { data } = await supabase
    .from("application_events")
    .select("id, application_id, event_type")
    .eq("application_id", applicationId)
    .eq("user_id", userId)
    .eq("event_type", "applied")
    .order("event_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (data as Pick<ApplicationEvent, "id" | "application_id" | "event_type"> | null) ?? null;
}

async function resolveOwnedEvent(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"],
  userId: string,
  eventId: string,
  applicationId?: string,
): Promise<Pick<ApplicationEvent, "id" | "application_id" | "event_type"> | null | { error: string }> {
  if (isUuid(eventId)) {
    return getOwnedEvent(supabase, userId, eventId, applicationId);
  }

  const localAppliedApplicationId = getLocalAppliedApplicationId(eventId);
  if (!localAppliedApplicationId) return { error: "Invalid event id." };
  if (applicationId && localAppliedApplicationId !== applicationId) {
    return { error: "Invalid event id." };
  }

  return getOwnedAppliedEvent(supabase, userId, localAppliedApplicationId);
}

export async function createEvent(
  applicationId: string,
  eventType: EventType,
  eventDate: string,
  notes?: string,
) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(applicationId)) return { error: "Invalid application id." };
  if (typeof eventType !== "string" || typeof eventDate !== "string") {
    return { error: "Invalid event." };
  }
  if (!isEventType(eventType)) return { error: "Invalid event type." };
  if (!isIsoDate(eventDate)) return { error: "Invalid event date." };
  if (notes !== undefined && typeof notes !== "string") return { error: "Invalid notes." };
  const cleanedNotes = notes?.trim() ?? "";
  if (cleanedNotes.length > MAX_NOTES_LENGTH) return { error: "Notes are too long." };
  if (!(await ensureOwnsApplication(supabase, user.id, applicationId))) {
    return { error: "Application not found" };
  }

  // Auto-compute round_number for interview events
  let roundNumber: number | null = null;
  if (eventType === "interview") {
    const { data: existing } = await supabase
      .from("application_events")
      .select("round_number")
      .eq("application_id", applicationId)
      .eq("user_id", user.id)
      .eq("event_type", "interview");
    roundNumber = (existing?.length ?? 0) + 1;
  }

  const { data: insertedEvent, error: insertError } = await supabase
    .from("application_events")
    .insert({
      application_id: applicationId,
      user_id: user.id,
      event_type: eventType,
      event_date: eventDate,
      notes: cleanedNotes || null,
      round_number: roundNumber,
    })
    .select("*")
    .single();

  if (insertError) return { error: insertError.message };

  // Re-derive status from all events for this application
  const { data: allEvents } = await supabase
    .from("application_events")
    .select("event_type")
    .eq("application_id", applicationId)
    .eq("user_id", user.id);

  const newStatus = deriveStatus(allEvents ?? []);
  const { error: statusError } = await supabase
    .from("applications")
    .update({ status: newStatus })
    .eq("id", applicationId)
    .eq("user_id", user.id);

  if (statusError) return { error: statusError.message };

  revalidateApplicationSurfaces();
  return { event: insertedEvent as ApplicationEvent, status: newStatus as Status };
}

export async function updateEventDate(eventId: string, applicationId: string, newDate: string) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(applicationId)) return { error: "Invalid event id." };
  if (!isIsoDate(newDate)) return { error: "Invalid event date." };

  const thisEvent = await resolveOwnedEvent(supabase, user.id, eventId, applicationId);
  if (thisEvent && "error" in thisEvent) return thisEvent;
  if (!thisEvent) return { error: "Event not found" };

  // Only applied events have a constraint: they can't be set after any other event
  if (thisEvent.event_type === "applied") {
    const { data: others } = await supabase
      .from("application_events")
      .select("event_date")
      .eq("application_id", applicationId)
      .eq("user_id", user.id)
      .neq("id", thisEvent.id);

    if (others?.some((e) => newDate > e.event_date)) {
      return { error: "Applied date cannot be after a later event" };
    }
  }

  const { data: updatedEvent, error } = await supabase
    .from("application_events")
    .update({ event_date: newDate })
    .eq("id", thisEvent.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return { error: error.message };
  revalidateApplicationSurfaces();
  return { event: updatedEvent as ApplicationEvent };
}

export async function updateEventNotes(eventId: string, notes: string) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  if (typeof notes !== "string") return { error: "Invalid notes." };
  const cleanedNotes = notes.trim();
  if (cleanedNotes.length > MAX_NOTES_LENGTH) return { error: "Notes are too long." };
  const event = await resolveOwnedEvent(supabase, user.id, eventId);
  if (event && "error" in event) return event;
  if (!event) return { error: "Event not found" };

  const { data: updatedEvent, error } = await supabase
    .from("application_events")
    .update({ notes: cleanedNotes || null })
    .eq("id", event.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return { error: error.message };
  revalidateApplicationSurfaces();
  return { event: updatedEvent as ApplicationEvent };
}

export async function deleteEvent(eventId: string, applicationId: string) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(eventId) || !isUuid(applicationId)) return { error: "Invalid event id." };
  const event = await getOwnedEvent(supabase, user.id, eventId, applicationId);
  if (!event) return { error: "Event not found" };

  const { error } = await supabase
    .from("application_events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  // Re-derive status after deletion
  const { data: remaining } = await supabase
    .from("application_events")
    .select("event_type")
    .eq("application_id", applicationId)
    .eq("user_id", user.id);

  const newStatus = deriveStatus(remaining ?? []);
  const { error: statusError } = await supabase
    .from("applications")
    .update({ status: newStatus })
    .eq("id", applicationId)
    .eq("user_id", user.id);

  if (statusError) return { error: statusError.message };

  revalidateApplicationSurfaces();
  return { status: newStatus as Status };
}
