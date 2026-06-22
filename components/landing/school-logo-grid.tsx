import { LANDING_SCHOOL_LOGOS } from "@/lib/landing/school-logos";

export function SchoolLogoGrid() {
  return (
    <ul className="mkt-school-grid">
      {LANDING_SCHOOL_LOGOS.map((school) => (
        <li key={school.src}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={school.src}
            alt={school.name}
            width={school.width}
            height={school.height}
            loading="lazy"
            decoding="async"
            style={{ "--logo-scale": school.scale } as React.CSSProperties}
          />
        </li>
      ))}
    </ul>
  );
}
