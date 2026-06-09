"use client"

import * as React from "react"
import { useOverlayState } from "@heroui/react"
import { XIcon } from "lucide-react"
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components/Modal"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type DialogContextValue = ReturnType<typeof useOverlayState>

const DialogContext = React.createContext<DialogContextValue | null>(null)

function useDialogState() {
  const state = React.useContext(DialogContext)
  if (!state) {
    throw new Error("DialogContent must be rendered inside Dialog")
  }
  return state
}

function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  const state = useOverlayState({ isOpen: open, defaultOpen, onOpenChange })

  return <DialogContext.Provider value={state}>{children}</DialogContext.Provider>
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof AriaDialog> & {
  showCloseButton?: boolean
}) {
  const state = useDialogState()

  return (
    <ModalOverlay
      isDismissable
      isOpen={state.isOpen}
      onOpenChange={state.setOpen}
      className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center bg-foreground/14 p-4 duration-200 supports-backdrop-filter:backdrop-blur-[4px]"
    >
      <Modal className="flex max-h-[calc(100dvh-2rem)] w-full justify-center overflow-y-auto outline-none">
        <AriaDialog
          data-slot="dialog-content"
          className={cn(
            "relative grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-2xl border border-rule-strong bg-popover p-5 text-sm text-popover-foreground shadow-[0_34px_110px_-64px_color-mix(in_oklab,var(--ink)_85%,transparent)] outline-none sm:max-w-sm",
            className
          )}
          {...props}
        >
          {children as React.ReactNode}
          {showCloseButton && (
            <Button
              type="button"
              variant="ghost"
              className="absolute right-3 top-3"
              size="icon-sm"
              onClick={() => state.close()}
              aria-label="Close"
            >
              <XIcon />
            </Button>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof Heading>) {
  return (
    <Heading
      data-slot="dialog-title"
      slot="title"
      className={cn("text-base font-semibold leading-none tracking-normal", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
}
