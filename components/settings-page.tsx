"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { motionVariants } from "@/lib/ui/motion";

interface Props {
  userEmail: string | null | undefined;
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", description: "Paper, always.", icon: Sun },
  { value: "dark", label: "Dark", description: "Ink, always.", icon: Moon },
  { value: "system", label: "System", description: "Follow your OS.", icon: Monitor },
] as const;

export function SettingsPage({ userEmail }: Props) {
  const safeEmail = userEmail ?? "";
  const initials = getInitials(safeEmail);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <div className="page-shell min-h-screen bg-background">
      <main className="max-w-3xl mx-auto px-6 sm:px-10 lg:px-16 pt-24 sm:pt-28 lg:pt-32 pb-24">
        <motion.header
          className="masthead mb-14"
          variants={motionVariants.riseIn}
          initial="hidden"
          animate="visible"
        >
          <div className="flex items-baseline justify-between pb-4">
            <span className="label-micro">Settings</span>
          </div>
          <span className="rule-strong" />
          <div className="mt-8">
            <h1 className="display-serif text-[4.5rem] sm:text-[5.25rem] text-foreground">
              Settings
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              Your account and theme.
            </p>
          </div>
        </motion.header>

        <motion.div
          variants={motionVariants.fadeIn}
          initial="hidden"
          animate="visible"
        >
          <Section label="01" title="Account">
            <div className="flex items-center gap-5 py-5">
              <div
                className="inline-flex size-12 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-medium tracking-[0.1em] uppercase text-foreground"
                style={{ background: "color-mix(in oklab, var(--ink) 7%, transparent)" }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="label-meta">Signed in as</p>
                <p className="mt-1 truncate text-[16px] font-medium text-foreground tracking-tight">
                  {safeEmail || "-"}
                </p>
              </div>
              <form action={logout}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  style={{ borderColor: "var(--rule)" }}
                >
                  <LogOut size={12} strokeWidth={1.75} />
                  Sign out
                </button>
              </form>
            </div>
          </Section>

          <Section label="02" title="Appearance" description="How Launchpad looks in this browser.">
            <div
              role="radiogroup"
              aria-label="Theme"
              className="grid grid-cols-1 sm:grid-cols-3 divide-x divide-y border-y sm:divide-y-0"
              style={{ borderColor: "var(--rule)" }}
            >
              {THEME_OPTIONS.map((opt) => {
                const active = mounted && theme === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTheme(opt.value)}
                    suppressHydrationWarning
                    className={`relative flex flex-col items-start gap-3 p-5 text-left transition-colors duration-150 ${
                      active
                        ? "bg-[color-mix(in_oklab,var(--primary)_6%,transparent)]"
                        : "hover:bg-[color-mix(in_oklab,var(--ink)_3%,transparent)]"
                    }`}
                    style={{ borderColor: "var(--rule)" }}
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.5}
                      className={active ? "text-foreground" : "text-muted-foreground"}
                    />
                    <div>
                      <p className="display-serif text-[18px] font-normal text-foreground tracking-tight">
                        {opt.label}
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {opt.description}
                      </p>
                    </div>
                    {active && (
                      <span
                        className="absolute left-0 bottom-0 h-[2px] w-full"
                        style={{ background: "var(--primary)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Section>
        </motion.div>
      </main>
    </div>
  );
}

function Section({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="label-micro">{label}</span>
        <h2 className="display-serif text-[24px] text-foreground">{title}</h2>
      </div>
      {description && (
        <p className="mb-5 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      <span className="rule mb-0" />
      <div className="py-5">{children}</div>
      <span className="rule mt-0" />
    </section>
  );
}

function getInitials(email: string): string {
  if (!email) return "U";
  const name = email.split("@")[0]?.replace(/[._-]+/g, " ") ?? "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return email.slice(0, 1).toUpperCase();
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
