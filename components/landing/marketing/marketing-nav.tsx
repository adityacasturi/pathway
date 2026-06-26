"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Pathway home" className="inline-flex items-center">
      <Image
        src="/brand/pathway-logo-black-transparent-600w.png"
        alt="Pathway"
        width={600}
        height={148}
        priority
        className={cn("brand-wordmark h-7 w-auto", className)}
      />
    </Link>
  );
}

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="mkt-nav" data-scrolled={scrolled ? "true" : "false"}>
      <div className="mkt-nav-inner">
        <Wordmark className="mkt-nav-wordmark" />
        <div className="hidden items-center gap-2 sm:flex">
          <Link href="/login" className="public-nav-button public-nav-button-secondary">
            Sign in
          </Link>
          <Link href="/register" className="public-nav-button public-nav-button-primary">
            Register
          </Link>
        </div>
      </div>
    </header>
  );
}

export { Wordmark };
