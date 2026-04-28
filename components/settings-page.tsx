"use client";

import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { motionVariants } from "@/lib/ui/motion";

interface Props {
  userEmail: string | null | undefined;
}

export function SettingsPage({ userEmail }: Props) {
  const safeEmail = userEmail ?? "";
  const initials = getInitials(safeEmail);

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
              Your account.
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
