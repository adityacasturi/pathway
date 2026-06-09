"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import type { LandingTerminalSnapshot } from "@/lib/landing/terminal-types";
import "./terminal-landing.css";

const COMMANDS = [
  { id: "login", label: "login", href: "/login" },
  { id: "register", label: "register", href: "/register" },
] as const;

const CHAR_DELAY_MS = 3;
const LINE_PAUSE_MS = 35;

const PATHWAY_ASCII = String.raw`
                                                  @@@@@@                  @@@@@@@@@@@@@                                           @@@@
                                               @@@@@@@@                   @@@@@@@@@@@@@@@@@                                       @@@@
                                             @@@@@@@@                     @@@@@@@@@@@@@@@@@@@                        @@@@@        @@@@
                                           @@@@@@@@                       @@@@           @@@@@                       @@@@@        @@@@
                                        @@@@@@@@@@      @@@@@@@@0         @@@@            @@@@                       @@@@@        @@@@      
                                      @@@@@@@@@@      @@@@@@@@@@          @@@@            @@@@    @@@@@@@@@@@@    @@@@@@@@@@@@@@  @@@@ @@@@@@@@@@@    @@@@        @@@@@        @@@@@   @@@@@@@@@@@@@   @@@@@          @@@@
                                   @@@@@@@@@@@       @@@@@@@@@@           @@@@           @@@@@  @@@@@@@@@@@@@@@@  @@@@@@@@@@@@@@  @@@@@@@@@@@@@@@@@   @@@@@       @@@@@@       @@@@   @@@@@@@@@@@@@@@   @@@@@        @@@@
                                 @@@@@@@@@@@@       @@@@@@@@@@            @@@@         @@@@@@   @@@@        @@@@     @@@@@        @@@@@        @@@@@   @@@@      @@@@@@@@     @@@@@  @@@@        @@@@@   @@@@       @@@@
                               @@@@@@@@@@@@        @@@@@@@@@@             @@@@@@@@@@@@@@@@@@                @@@@     @@@@@        @@@@@         @@@@    @@@@    @@@@ @@@@     @@@@               @@@@@    @@@@     @@@@
                            @@@@@@@@@@@@@        @@@@@@@@@@@@             @@@@@@@@@@@@@@@        @@@@@@@@@@@@@@@     @@@@@        @@@@          @@@@    @@@@@   @@@@  @@@@   @@@@     @@@@@@@@@@@@@@@@     @@@@   @@@@
                         @@@@@@@@@@@@@@         @@@@@@@@@@@@              @@@@                 @@@@@@       @@@@     @@@@@        @@@@          @@@@     @@@@  @@@@    @@@@ @@@@@    @@@@@        @@@@      @@@@  @@@
                       @@@@@@@@@@@@@@@        @@@@@@@@@@@@@               @@@@                 @@@@         @@@@     @@@@@        @@@@          @@@@     @@@@@@@@@     @@@@ @@@@    @@@@@        @@@@@       @@@@@@@
                    @@@@@@@@@@@@@@@@         @@@@@@@@@@@@@                @@@@                 @@@@@      @@@@@@      @@@@@       @@@@          @@@@      @@@@@@@@      @@@@@@@     @@@@@      @@@@@@@        @@@@@
                  @@@@@@@@@@@@@@@@@         @@@@@@@@@@@@@                 @@@@                  @@@@@@@@@@@@@@@@      @@@@@@@@@@  @@@@          @@@@       @@@@@@       @@@@@@@      @@@@@@@@@@@@ @@@@        @@@@
                @@@@@@@@@@@@@@@@@          @@@@@@@@@@@@@                  @@@@                     @@@@@@   @@@@         @@@@@@   @@@@          @@@@       @@@@@         @@@@@          @@@@@@    @@@@       @@@@
                                                                                                                                                                                                            @@@@
                                                                                                                                                                                                           @@@@
                                                                                                                                                                                                          @@@@
                                                                                                                                                                                                         @@@@
`;

function normalizeAsciiArt(value: string): string {
  const lines = value.trimEnd().split("\n").filter((line) => line.trim().length > 0);
  const commonIndent = Math.min(
    ...lines.map((line) => line.match(/^ */)?.[0].length ?? 0),
  );
  return lines.map((line) => line.slice(commonIndent).trimEnd()).join("\n");
}

const PATHWAY_ASCII_NORMALIZED = normalizeAsciiArt(PATHWAY_ASCII);

function buildScript(snapshot: LandingTerminalSnapshot): string {
  const lines = [
    "PATHWAY v2.1",
    "loading recruiting telemetry... ok",
    `roles in the last 7 days: ${snapshot.roleCount}`,
    "",
    "most recent roles:",
  ];

  for (const role of snapshot.recentRoles) {
    lines.push(`  [${role.timeLabel}] ${role.company} — ${role.role}`);
  }

  return lines.join("\n");
}

export function TerminalLandingPage({ snapshot }: { snapshot: LandingTerminalSnapshot }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const fullText = useMemo(() => buildScript(snapshot), [snapshot]);
  const [visibleChars, setVisibleChars] = useState(reduceMotion ? Number.POSITIVE_INFINITY : 0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const terminalRef = useRef<HTMLDivElement>(null);

  const totalChars = fullText.length;
  const typedText = reduceMotion ? fullText : fullText.slice(0, visibleChars);
  const isTypingComplete = visibleChars >= totalChars;
  const promptReady = reduceMotion || isTypingComplete;

  useEffect(() => {
    if (reduceMotion || visibleChars >= totalChars) {
      return;
    }

    const nextChar = fullText[visibleChars];
    const delay = nextChar === "\n" ? LINE_PAUSE_MS : CHAR_DELAY_MS;
    const timer = window.setTimeout(() => {
      setVisibleChars((current) => current + 1);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [fullText, reduceMotion, totalChars, visibleChars]);

  useEffect(() => {
    terminalRef.current?.focus();
  }, []);

  const runCommand = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!promptReady) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((current) => (current + 1) % COMMANDS.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) => (current - 1 + COMMANDS.length) % COMMANDS.length);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        runCommand(COMMANDS[selectedIndex].href);
      }
    },
    [promptReady, runCommand, selectedIndex],
  );

  return (
    <main className="landing-terminal">
      <div
        ref={terminalRef}
        className="landing-terminal__screen"
        tabIndex={0}
        role="application"
        aria-label="Pathway recruiting terminal"
        onKeyDown={onKeyDown}
      >
        <div className="landing-terminal__chrome" aria-hidden>
          <span className="landing-terminal__dot" />
          <span className="landing-terminal__dot" />
          <span className="landing-terminal__dot" />
        </div>

        <div className="landing-terminal__body">
          <pre className="landing-terminal__ascii" aria-label="Pathway logo">
            {PATHWAY_ASCII_NORMALIZED}
          </pre>
          <pre className="landing-terminal__line" aria-live="polite">
            {typedText}
            {!isTypingComplete ? <span className="landing-terminal__cursor" aria-hidden /> : null}
          </pre>

          {promptReady ? (
            <div className="landing-terminal__prompt-block">
              {COMMANDS.map((command, index) => (
                <button
                  key={command.id}
                  type="button"
                  className="landing-terminal__command-row"
                  data-selected={selectedIndex === index}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => runCommand(command.href)}
                >
                  <span className="landing-terminal__command-prefix">pathway &gt;</span>
                  <span>{command.label}</span>
                </button>
              ))}
              <p className="landing-terminal__hint">↑/↓ choose · Enter to open</p>
            </div>
          ) : null}
        </div>
      </div>

      <nav className="landing-terminal__sr-links" aria-label="Authentication">
        <a href="/login">Sign in</a>
        <a href="/register">Create account</a>
      </nav>
    </main>
  );
}
