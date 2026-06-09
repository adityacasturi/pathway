"use client";

import type { CSSProperties, ReactNode } from "react";

type ListTag = "ul" | "ol" | "div";
type ItemTag = "li" | "div";

export function MotionStaggerList({
  children,
  className,
  style,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: ListTag;
}) {
  if (as === "ul") {
    return (
      <ul className={className} style={style}>
        {children}
      </ul>
    );
  }

  if (as === "ol") {
    return (
      <ol className={className} style={style}>
        {children}
      </ol>
    );
  }

  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

export function MotionStaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: ItemTag;
  index?: number;
}) {
  if (as === "li") {
    return <li className={className}>{children}</li>;
  }

  return <div className={className}>{children}</div>;
}
