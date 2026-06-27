"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { Archive, ArchiveRestore, CalendarDays, Link2, MapPin, Plus, Trash2, X } from "lucide-react";
import { MetadataRow } from "@/components/inspector/metadata-row";
import { Application, ApplicationEvent, EventType, Status } from "@/types/application";
import { createEvent, deleteEvent, updateEventDate, updateEventNotes } from "@/lib/actions/events";
import {
  addEvent,
  applyEventPatch,
  getNextInterviewRound,
  normalizeApplicationState,
  removeEvent,
  replaceEvent,
} from "@/lib/config/application-state";
import { AddEventPanel } from "@/components/application-detail/add-event-panel";
import { FloatingSyncToast, type SyncState } from "@/components/application-detail/sync-toast";
import { CompanyLogo } from "@/components/company-logo";
import {
  lookupCompanyLogoAssetKey,
  lookupCompanySlug,
  lookupCompanyWebsiteUrl,
  type CompanyLogoAssetByName,
  type CompanySlugByName,
  type CompanyWebsiteByName,
} from "@/lib/logo/company-website-lookup";
import { InspectorLinkField } from "@/components/inspector/inspector-link-field";
import { InspectorSeasonField } from "@/components/inspector/inspector-season-field";
import { InspectorEditableField } from "@/components/inspector/inspector-editable-field";
import { deleteApplication, updateApplicationFields } from "@/lib/actions/applications";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineError } from "@/components/ui/inline-error";
import { formatCompactLocationLabel } from "@/lib/feed/us-locations";
import { normalizeUrl } from "@/lib/url";
import { useMounted } from "@/lib/ui/use-mounted";
import { InspectorActivityList } from "@/components/applications/inspector-activity-list";
import { cn } from "@/lib/utils";

function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function buildTempEvent(
  application: Application,
  eventType: EventType,
  eventDate: string,
  notes: string,
): ApplicationEvent {
  return {
    id: `temp-${crypto.randomUUID()}`,
    clientKey: crypto.randomUUID(),
    application_id: application.id,
    event_type: eventType,
    event_date: eventDate,
    notes: notes.trim() || null,
    round_number: eventType === "interview" ? getNextInterviewRound(application.events) : null,
    created_at: new Date().toISOString(),
  };
}

export function ApplicationInspector({
  application,
  companyWebsiteByName = {},
  companySlugByName = {},
  companyLogoAssetByName = {},
  archived = false,
  onArchiveChange,
  onDeleted,
  onClose,
  className,
}: {
  application: Application | null;
  companyWebsiteByName?: CompanyWebsiteByName;
  companySlugByName?: CompanySlugByName;
  companyLogoAssetByName?: CompanyLogoAssetByName;
  archived?: boolean;
  onArchiveChange?: (archived: boolean) => void;
  onDeleted?: () => void;
  onClose: () => void;
  className?: string;
}) {
  const [eventType, setEventType] = useState<EventType>("oa");
  const [eventDate, setEventDate] = useState<string>(todayISO);
  const [notes, setNotes] = useState("");
  const [addingEvent, setAddingEvent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({ status: "idle", label: null });
  const [optimisticApplication, setOptimisticApplication] = useState<Application | null>(
    application,
  );
  const mounted = useMounted();
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteState, setDeleteState] = useState<"idle" | "pending">("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const open = Boolean(application);

  useEffect(() => {
    if (!application) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptimisticApplication(normalizeApplicationState(application));
    setEventType("oa");
    setEventDate(todayISO());
    setNotes("");
    setError(null);
    setSyncState({ status: "idle", label: null });
    setAddEventOpen(false);
    setConfirmDeleteOpen(false);
    setDeleteState("idle");
    setDeleteError(null);
  }, [application?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDeleteApplication() {
    if (!optimisticApplication) return;
    setDeleteError(null);
    setDeleteState("pending");
    const result = await deleteApplication(optimisticApplication.id);
    if (result?.error) {
      setDeleteError(result.error);
      setDeleteState("idle");
      return;
    }
    setDeleteState("idle");
    setConfirmDeleteOpen(false);
    onDeleted?.();
    onClose();
  }

  useEffect(() => {
    if (!application) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptimisticApplication((current) => {
      if (!current || current.id !== application.id) return current;
      const keyById = new Map(current.events.map((e) => [e.id, e.clientKey] as const));
      const events = application.events.map((e) => {
        const existingKey = keyById.get(e.id);
        return e.clientKey || !existingKey ? e : { ...e, clientKey: existingKey };
      });
      return normalizeApplicationState({ ...application, events });
    });
  }, [application]);

  function startSync(label: string) {
    setError(null);
    setSyncState({ status: "pending", label });
  }

  function finishSync(errorMessage?: string | null) {
    if (errorMessage) {
      setSyncState({ status: "error", label: errorMessage });
      return;
    }
    setSyncState({ status: "success", label: "Saved" });
    window.setTimeout(() => {
      setSyncState((current) =>
        current.status === "success" ? { status: "idle", label: null } : current,
      );
    }, 1200);
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!optimisticApplication || addingEvent) return;

    setAddingEvent(true);
    startSync("Adding event");

    const previous = optimisticApplication;
    const tempEvent = buildTempEvent(previous, eventType, eventDate, notes);
    setOptimisticApplication(addEvent(previous, tempEvent));

    const result = await createEvent(previous.id, eventType, eventDate, notes);
    if ("error" in result) {
      const message = result.error ?? "Unable to add event.";
      setOptimisticApplication(previous);
      setError(message);
      finishSync(message);
    } else {
      const insertedEvent = result.event;
      const nextStatus = result.status;
      setOptimisticApplication((current) => {
        if (!current || !insertedEvent) return current;
        const reconciled = replaceEvent(current, tempEvent.id, insertedEvent);
        return nextStatus ? { ...reconciled, status: nextStatus } : reconciled;
      });
      setNotes("");
      setEventDate(todayISO());
      setAddEventOpen(false);
      finishSync();
    }
    setAddingEvent(false);
  }

  async function handleDeleteEvent(event: ApplicationEvent): Promise<string | null> {
    if (!optimisticApplication) return "Application not loaded";

    const previous = optimisticApplication;
    startSync("Deleting event");
    setOptimisticApplication(removeEvent(previous, event.id));

    const result = await deleteEvent(event.id, previous.id);
    if ("error" in result) {
      const message = result.error ?? "Unable to delete event.";
      setOptimisticApplication(previous);
      finishSync(message);
      return message;
    }

    const nextStatus = result.status;
    setOptimisticApplication((current) => {
      if (!current || !nextStatus) return current;
      return { ...current, status: nextStatus as Status };
    });
    finishSync();
    return null;
  }

  async function handleUpdateEventDate(
    event: ApplicationEvent,
    newDate: string,
  ): Promise<string | null> {
    if (!optimisticApplication) return "Application not loaded";

    const previous = optimisticApplication;
    startSync("Saving event date");
    setOptimisticApplication(applyEventPatch(previous, event.id, { event_date: newDate }));

    const result = await updateEventDate(event.id, previous.id, newDate);
    if ("error" in result) {
      const message = result.error ?? "Unable to save event date.";
      setOptimisticApplication(previous);
      finishSync(message);
      return message;
    }

    const updatedEvent = result.event;
    setOptimisticApplication((current) => {
      if (!current || !updatedEvent) return current;
      return replaceEvent(current, event.id, updatedEvent);
    });
    finishSync();
    return null;
  }

  async function handleUpdateField(
    fields: Partial<
      Pick<Application, "company" | "role" | "location" | "posting_url" | "season">
    >,
  ) {
    if (!optimisticApplication) return;

    const previous = optimisticApplication;
    startSync("Saving");
    setOptimisticApplication({ ...previous, ...fields });

    const result = await updateApplicationFields(previous.id, fields);
    if ("error" in result && result.error) {
      setOptimisticApplication(previous);
      finishSync(result.error);
      return;
    }
    finishSync();
  }

  async function handleUpdateEventNotes(
    event: ApplicationEvent,
    nextNotes: string,
  ): Promise<string | null> {
    if (!optimisticApplication) return "Application not loaded";

    const previous = optimisticApplication;
    startSync("Saving event notes");
    setOptimisticApplication(
      applyEventPatch(previous, event.id, { notes: nextNotes.trim() || null }),
    );

    const result = await updateEventNotes(event.id, nextNotes);
    if ("error" in result) {
      const message = result.error ?? "Unable to save event notes.";
      setOptimisticApplication(previous);
      finishSync(message);
      return message;
    }

    const updatedEvent = result.event;
    setOptimisticApplication((current) => {
      if (!current || !updatedEvent) return current;
      return replaceEvent(current, event.id, updatedEvent);
    });
    finishSync();
    return null;
  }

  if (!optimisticApplication || !open) return null;

  const displayCompany = application?.company ?? optimisticApplication.company;

  const addEventDialog =
    mounted && addEventOpen
      ? createPortal(
          <Dialog
            open={addEventOpen}
            onOpenChange={(next) => {
              setAddEventOpen(next);
              if (!next) setError(null);
            }}
          >
            <DialogContent className="gap-0 rounded-xl p-5 sm:max-w-md">
              <DialogHeader className="mb-4">
                <DialogTitle>Add event</DialogTitle>
              </DialogHeader>
              <AddEventPanel
                eventType={eventType}
                eventDate={eventDate}
                notes={notes}
                addingEvent={addingEvent}
                error={error}
                onEventTypeChange={setEventType}
                onEventDateChange={setEventDate}
                onNotesChange={setNotes}
                onSubmitEvent={handleAddEvent}
                onClearError={() => setError(null)}
              />
            </DialogContent>
          </Dialog>,
          document.body,
        )
      : null;

  const panel = (
    <div
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-card",
        className,
      )}
      aria-label={`${optimisticApplication.company} details`}
    >
      <header className="relative shrink-0 border-b border-border px-5 py-5 pr-12">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-4 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
        >
          <X size={18} strokeWidth={1.75} />
        </button>

        <div className="flex items-center gap-3">
          <CompanyLogo
            company={displayCompany}
            companySlug={lookupCompanySlug(displayCompany, companySlugByName)}
            logoAssetKey={lookupCompanyLogoAssetKey(displayCompany, companyLogoAssetByName)}
            websiteUrl={lookupCompanyWebsiteUrl(displayCompany, companyWebsiteByName)}
            size={56}
          />
          <div className="flex h-14 min-w-0 flex-1 flex-col justify-center gap-0">
            <InspectorEditableField
              value={optimisticApplication.company}
              onSave={(company) => void handleUpdateField({ company })}
              ariaLabel="Company name"
              variant="title"
              placeholder="Company name"
              className="px-1 py-0"
            />
            <InspectorEditableField
              value={optimisticApplication.role}
              onSave={(role) => void handleUpdateField({ role })}
              ariaLabel="Role"
              variant="subtitle"
              placeholder="Role title"
              className="px-1 py-0"
            />
          </div>
        </div>
      </header>

      <section
        aria-label="Details"
        className="shrink-0 border-b border-border px-5 py-3.5"
      >
        <div className="space-y-1">
          <MetadataRow icon={CalendarDays}>
            <InspectorSeasonField
              value={optimisticApplication.season}
              onSave={(season) => void handleUpdateField({ season })}
              className="-mx-1.5"
            />
          </MetadataRow>
          <MetadataRow icon={MapPin}>
            <InspectorEditableField
              value={optimisticApplication.location ?? ""}
              onSave={(next) => void handleUpdateField({ location: next.trim() || null })}
              ariaLabel="Location"
              variant="meta"
              placeholder="Add location"
              allowEmpty
              className="-mx-1.5"
              formatDisplay={(location) =>
                formatCompactLocationLabel(location, 2) ?? location.trim()
              }
            />
          </MetadataRow>
          <MetadataRow icon={Link2}>
            <InspectorLinkField
              value={optimisticApplication.posting_url ?? ""}
              onSave={(next) => {
                const normalized = next.trim() ? normalizeUrl(next) : null;
                void handleUpdateField({ posting_url: normalized });
              }}
              ariaLabel="Posting link"
              className="-mx-1.5"
            />
          </MetadataRow>
        </div>
      </section>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <section aria-label="Timeline">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Timeline</h2>
            <button
              type="button"
              onClick={() => setAddEventOpen(true)}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <Plus size={13} strokeWidth={1.75} aria-hidden />
              Add event
            </button>
          </div>
          <InspectorActivityList
            events={optimisticApplication.events}
            onDeleteEvent={handleDeleteEvent}
            onUpdateEventDate={handleUpdateEventDate}
            onUpdateEventNotes={handleUpdateEventNotes}
          />
        </section>
      </div>

      {onArchiveChange || onDeleted ? (
        <footer className="relative shrink-0 border-t border-border px-5 py-3">
          <FloatingSyncToast
            state={syncState}
            onDismiss={() => setSyncState({ status: "idle", label: null })}
            placement="above-footer"
          />
          <div className="flex gap-2">
              {onArchiveChange ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1 gap-1.5 text-xs"
                  onClick={() => onArchiveChange(!archived)}
                >
                  {archived ? (
                    <ArchiveRestore size={14} strokeWidth={1.75} aria-hidden />
                  ) : (
                    <Archive size={14} strokeWidth={1.75} aria-hidden />
                  )}
                  {archived ? "Unarchive" : "Archive"}
                </Button>
              ) : null}
              {onDeleted ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="application-delete"
                  className="h-8 flex-1 gap-1.5 text-xs text-destructive hover:text-destructive"
                  onClick={() => {
                    setDeleteError(null);
                    setConfirmDeleteOpen(true);
                  }}
                >
                  <Trash2 size={14} strokeWidth={1.75} aria-hidden />
                  Delete
                </Button>
              ) : null}
          </div>
        </footer>
      ) : (
        <FloatingSyncToast
          state={syncState}
          onDismiss={() => setSyncState({ status: "idle", label: null })}
        />
      )}
    </div>
  );

  const deleteDialog = (
    <Dialog
      open={confirmDeleteOpen}
      onOpenChange={(open) => {
        setConfirmDeleteOpen(open);
        if (!open) setDeleteError(null);
      }}
    >
      <DialogContent className="max-w-sm gap-0 rounded-xl p-5" showCloseButton={false}>
        <DialogHeader className="mb-3">
          <DialogTitle className="text-base font-semibold">Delete application?</DialogTitle>
        </DialogHeader>
        <p className="mb-5 text-sm text-muted-foreground">
          Permanently remove{" "}
          <span className="font-medium text-foreground">{optimisticApplication?.company}</span> and
          its event history.
        </p>
        {deleteError ? (
          <div className="mb-4">
            <InlineError message={deleteError} onRetry={() => setDeleteError(null)} />
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => setConfirmDeleteOpen(false)}
          >
            Cancel
          </Button>
          <AsyncButton
            type="button"
            data-testid="confirm-delete-application"
            state={deleteState}
            idleLabel="Delete"
            pendingLabel="Deleting"
            onClick={() => void handleDeleteApplication()}
            variant="destructive"
            size="sm"
            className="h-9"
          />
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className={cn(
            "flex h-[min(42rem,88dvh)] max-h-[88dvh] w-full flex-col gap-0 overflow-hidden rounded-xl border-border bg-card p-0 shadow-[0_34px_110px_-64px_color-mix(in_oklab,var(--ink)_85%,transparent)] sm:max-w-[var(--app-inspector-width)]",
          )}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              {optimisticApplication.company} — {optimisticApplication.role}
            </DialogTitle>
          </DialogHeader>
          {panel}
        </DialogContent>
      </Dialog>
      {addEventDialog}
      {deleteDialog}
    </>
  );
}
