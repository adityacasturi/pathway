const SCHOOL_LOGOS = [
  { name: "University of Washington", src: "/school-logos/uw.svg" },
  { name: "MIT", src: "/school-logos/mit.svg" },
  { name: "UC San Diego", src: "/school-logos/ucsd.svg" },
  { name: "University of Maryland", src: "/school-logos/umd.svg" },
  { name: "Georgia Tech", src: "/school-logos/gatech.svg" },
] as const;

export function SchoolLogoCarousel() {
  const logos = [...SCHOOL_LOGOS, ...SCHOOL_LOGOS, ...SCHOOL_LOGOS, ...SCHOOL_LOGOS];

  return (
    <section aria-label="Universities using Pathway">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-rule" />
        <p className="label-micro shrink-0">Used by students at</p>
        <span className="h-px flex-1 bg-rule" />
      </div>
      <div className="school-logo-fade overflow-hidden">
        <div className="school-logo-track flex w-max items-center gap-6">
          {logos.map((school, index) => (
            // Plain <img> because these are static local SVG marks.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${school.src}-${index}`}
              src={school.src}
              alt={index >= SCHOOL_LOGOS.length ? "" : `${school.name} logo`}
              width={112}
              height={36}
              loading="lazy"
              decoding="async"
              className="school-logo-img h-8 max-w-32 shrink-0 object-contain"
              aria-hidden={index >= SCHOOL_LOGOS.length}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
