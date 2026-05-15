"use server";

import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { limitServerActionByIp } from "@/lib/rate-limit";
import { formatSupabaseMutationError } from "@/lib/supabase/errors";
import { revalidatePath } from "next/cache";
import { ApplicationEvent, EventType, Status } from "@/types/application";

const EVENT_TYPES: readonly EventType[] = ["applied", "oa", "interview", "offer", "rejected", "note"];
const MAX_NOTES_LENGTH = 2000;
const WRITE_RATE_LIMIT_REQUESTS = 90;
const WRITE_RATE_LIMIT_WINDOW_MS = 60_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_APPLIED_EVENT_RE = /^local-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-applied$/i;

type CreateEventRpcResult = {
  event?: unknown;
  status?: unknown;
};

function revalidateApplicationSurfaces() {
  revalidatePath("/");
  revalidatePath("/applications");
  revalidatePath("/stats");
}

function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

async function limitEventWrite() {
  return limitServerActionByIp(
    "application-events:write",
    WRITE_RATE_LIMIT_REQUESTS,
    WRITE_RATE_LIMIT_WINDOW_MS,
  );
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
  deadlineDate?: string | null,
) {
  const rateLimit = await limitEventWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(applicationId)) return { error: "Invalid application id." };
  if (typeof eventType !== "string" || typeof eventDate !== "string") {
    return { error: "Invalid event." };
  }
  if (!isEventType(eventType)) return { error: "Invalid event type." };
  if (eventType === "applied") return { error: "The applied event is created with the application." };
  if (!isIsoDate(eventDate)) return { error: "Invalid event date." };
  if (deadlineDate != null && deadlineDate !== "" && !isIsoDate(deadlineDate)) {
    return { error: "Invalid deadline date." };
  }
  if (eventType !== "oa" && deadlineDate) {
    return { error: "Deadlines can only be added to OA events." };
  }
  if (notes !== undefined && typeof notes !== "string") return { error: "Invalid notes." };
  const cleanedNotes = notes?.trim() ?? "";
  const cleanedDeadlineDate = eventType === "oa" && deadlineDate ? deadlineDate : null;
  if (cleanedNotes.length > MAX_NOTES_LENGTH) return { error: "Notes are too long." };
  const { data, error } = await supabase.rpc("create_application_event", {
    p_application_id: applicationId,
    p_event_type: eventType,
    p_event_date: eventDate,
    p_notes: cleanedNotes || null,
    p_deadline_date: cleanedDeadlineDate,
  });

  if (error) return { error: formatSupabaseMutationError(error, "Unable to add event.") };

  const payload = data as CreateEventRpcResult | null;
  if (!payload?.event || typeof payload.status !== "string") {
    return { error: "Unable to add event." };
  }

  revalidateApplicationSurfaces();
  return { event: payload.event as ApplicationEvent, status: payload.status as Status };
}

export async function updateEventDeadline(
  eventId: string,
  applicationId: string,
  deadlineDate: string | null,
) {
  const rateLimit = await limitEventWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(applicationId)) return { error: "Invalid application id." };
  if (deadlineDate !== null && !isIsoDate(deadlineDate)) {
    return { error: "Invalid deadline date." };
  }

  const event = await resolveOwnedEvent(supabase, user.id, eventId, applicationId);
  if (event && "error" in event) return event;
  if (!event) return { error: "Event not found" };
  if (event.event_type !== "oa") return { error: "Deadlines can only be added to OA events." };

  const patch = deadlineDate === null
    ? { deadline_date: null, deadline_completed_at: null }
    : { deadline_date: deadlineDate };

  const { data: updatedEvent, error } = await supabase
    .from("application_events")
    .update(patch)
    .eq("id", event.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return { error: formatSupabaseMutationError(error, "Unable to save deadline.") };
  revalidateApplicationSurfaces();
  return { event: updatedEvent as ApplicationEvent };
}

export async function updateEventDeadlineCompletion(
  eventId: string,
  applicationId: string,
  completed: boolean,
) {
  const rateLimit = await limitEventWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(applicationId)) return { error: "Invalid application id." };
  if (typeof completed !== "boolean") return { error: "Invalid deadline state." };

  const event = await resolveOwnedEvent(supabase, user.id, eventId, applicationId);
  if (event && "error" in event) return event;
  if (!event) return { error: "Event not found" };
  if (event.event_type !== "oa") return { error: "Deadlines can only be completed for OA events." };

  const { data: updatedEvent, error } = await supabase
    .from("application_events")
    .update({ deadline_completed_at: completed ? new Date().toISOString() : null })
    .eq("id", event.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return { error: formatSupabaseMutationError(error, "Unable to update deadline.") };
  revalidateApplicationSurfaces();
  return { event: updatedEvent as ApplicationEvent };
}

export async function updateEventDate(eventId: string, applicationId: string, newDate: string) {
  const rateLimit = await limitEventWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(applicationId)) return { error: "Invalid application id." };
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

  if (error) return { error: formatSupabaseMutationError(error, "Unable to save event date.") };
  revalidateApplicationSurfaces();
  return { event: updatedEvent as ApplicationEvent };
}

export async function updateEventNotes(eventId: string, notes: string) {
  const rateLimit = await limitEventWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

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

  if (error) return { error: formatSupabaseMutationError(error, "Unable to save event notes.") };
  revalidateApplicationSurfaces();
  return { event: updatedEvent as ApplicationEvent };
}

export async function deleteEvent(eventId: string, applicationId: string) {
  const rateLimit = await limitEventWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(eventId) || !isUuid(applicationId)) return { error: "Invalid event id." };
  const event = await getOwnedEvent(supabase, user.id, eventId, applicationId);
  if (!event) return { error: "Event not found" };
  if (event.event_type === "applied") {
    return { error: "The applied event is required and cannot be deleted." };
  }

  const { error } = await supabase
    .from("application_events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", user.id);

  if (error) return { error: formatSupabaseMutationError(error, "Unable to delete event.") };

  const { data: application, error: statusError } = await supabase
    .from("applications")
    .select("status")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single();

  if (statusError) return { error: formatSupabaseMutationError(statusError, "Unable to load application status.") };

  revalidateApplicationSurfaces();
  return { status: application.status as Status };
}
