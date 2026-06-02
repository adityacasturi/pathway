import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function focusSearchFromContainer(container: HTMLElement | null | undefined) {
  const input = container?.querySelector("input");
  if (!(input instanceof HTMLInputElement)) return;
  input.focus();
  input.select();
}

export interface UseFocusSearchShortcutOptions {
  /** When false, `/` and ⌘K do nothing. Use a function for ref-backed modal guards. */
  enabled?: boolean | (() => boolean);
  /** Also focus on Meta/Ctrl+K. Default true. */
  metaK?: boolean;
}

export function useFocusSearchShortcut(
  containerRef: RefObject<HTMLElement | null>,
  options: UseFocusSearchShortcutOptions = {},
) {
  const { metaK = true } = options;
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    function isEnabled() {
      const enabled = optionsRef.current.enabled;
      if (enabled === undefined) return true;
      return typeof enabled === "function" ? enabled() : enabled;
    }

    function focus() {
      if (!isEnabled()) return;
      focusSearchFromContainer(containerRef.current);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (metaK && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focus();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (event.key === "/") {
        event.preventDefault();
        focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [containerRef, metaK]);
}
