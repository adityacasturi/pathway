"use client";

import { useEffect, useState } from "react";
import { Application } from "@/types/application";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ArchiveRestore } from "lucide-react";
import { deleteApplication } from "@/lib/actions/applications";
import { ApplicationRow } from "@/components/application-row";
import type { CompanyWebsiteByName } from "@/lib/logo/company-website-lookup";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/inline-error";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  applications: Application[];
  companyWebsiteByName?: CompanyWebsiteByName;
  hasActiveFilters: boolean;
  searchQuery: string;
  onOpen: (app: Application) => void;
  archivedIds: Set<string>;
  onArchiveChange: (applicationId: string, archived: boolean) => void;
}

export function ApplicationsTable({
  applications,
  companyWebsiteByName = {},
  hasActiveFilters,
  searchQuery,
  onOpen,
  archivedIds,
  onArchiveChange,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; app: Application } | null>(null);
  const [confirmDeleteApp, setConfirmDeleteApp] = useState<Application | null>(null);
  const [deleteState, setDeleteState] = useState<"idle" | "pending">("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    function closeMenu() {
      setContextMenu(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function handleDeleteConfirmed() {
    if (!confirmDeleteApp) return;
    setDeleteError(null);
    setDeleteState("pending");
    const result = await deleteApplication(confirmDeleteApp.id);
    if (result?.error) {
      setDeleteError(result.error);
      setDeleteState("idle");
      return;
    }
    setDeleteState("idle");
    setConfirmDeleteApp(null);
  }

  return (
    <div>
      {applications.length === 0 ? (
        <div
          key={hasActiveFilters ? "filtered-empty" : "base-empty"}
          className="flex flex-col items-center justify-center py-28 text-center"
        >
          <p className="display-serif text-[22px] text-foreground/80">
            {hasActiveFilters ? "Nothing matches." : "No applications yet."}
          </p>
          <p className="mt-3 text-[13px] text-muted-foreground/70">
            {hasActiveFilters
              ? `Try clearing "${searchQuery.trim()}" or the filters above.`
              : "Press N to add your first one."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {applications.map((app) => (
            <ApplicationRow
              key={app.id}
              application={app}
              companyWebsiteByName={companyWebsiteByName}
              archived={archivedIds.has(app.id)}
              onOpen={() => onOpen(app)}
              onContextMenu={(event) => {
                event.preventDefault();
                setContextMenu({ x: event.clientX, y: event.clientY, app });
              }}
            />
          ))}
        </ul>
      )}

      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
            className="fixed z-70 min-w-44 origin-top-left rounded-lg border bg-popover p-1 shadow-[0_18px_45px_-28px_color-mix(in_oklab,var(--ink)_55%,transparent)]"
            style={{ left: contextMenu.x, top: contextMenu.y, borderColor: "var(--rule-strong)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              data-testid="application-context-delete"
              onClick={() => {
                onArchiveChange(contextMenu.app.id, !archivedIds.has(contextMenu.app.id));
                setContextMenu(null);
              }}
              className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)] hover:text-foreground"
            >
              {archivedIds.has(contextMenu.app.id) ? (
                <ArchiveRestore size={13} strokeWidth={1.75} />
              ) : (
                <Archive size={13} strokeWidth={1.75} />
              )}
              {archivedIds.has(contextMenu.app.id)
                ? "Unarchive application"
                : "Archive application"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmDeleteApp(contextMenu.app);
                setDeleteError(null);
                setContextMenu(null);
              }}
              className="h-9 w-full rounded-md px-3 text-left text-[13px] text-destructive transition-colors duration-150 hover:bg-destructive/10"
            >
              Delete application
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        open={Boolean(confirmDeleteApp)}
        onOpenChange={(open) => {
          if (open) return;
          setConfirmDeleteApp(null);
          setDeleteError(null);
        }}
      >
        <DialogContent
          className="max-w-md gap-0 rounded-xl border bg-popover p-7"
          showCloseButton={false}
          style={{ borderColor: "var(--rule-strong)" }}
        >
          <DialogHeader className="mb-4">
            <DialogTitle className="display-serif text-[22px] font-normal text-foreground">
              Delete application?
            </DialogTitle>
          </DialogHeader>
          <p className="mb-6 text-[13px] leading-relaxed text-muted-foreground">
            This will permanently remove{" "}
            <span className="font-medium text-foreground">{confirmDeleteApp?.company}</span> and
            its timeline of events.
          </p>
          {deleteError ? (
            <div className="mb-4">
              <InlineError message={deleteError} onRetry={() => setDeleteError(null)} />
            </div>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setConfirmDeleteApp(null);
                setDeleteError(null);
              }}
              className="h-9 px-4 text-[12px]"
            >
              Cancel
            </Button>
            <AsyncButton
              type="button"
              data-testid="confirm-delete-application"
              state={deleteState}
              idleLabel="Delete"
              pendingLabel="Deleting"
              onClick={handleDeleteConfirmed}
              className="h-9 bg-destructive/15 px-5 text-[12px] font-medium text-destructive hover:bg-destructive/25"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
