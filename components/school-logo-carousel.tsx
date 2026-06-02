const SCHOOL_LOGOS = [
  { name: "University of Washington", src: "/school-logos/uw.svg" },
  { name: "MIT", src: "/school-logos/mit.svg" },
  { name: "UC San Diego", src: "/school-logos/ucsd.svg" },
  { name: "UCLA", src: "/school-logos/ucla.svg" },
  { name: "Georgia Tech", src: "/school-logos/gatech.svg" },
] as const;

export function SchoolLogoCarousel() {
  return (
    <div className="lp-hero-schools" aria-label="Universities using Pathway">
      <p className="label-micro mb-4 text-center text-muted-foreground">Used by students at</p>
      <ul className="school-logo-row">
        {SCHOOL_LOGOS.map((school) => (
          <li key={school.src}>
            {/* Plain <img> because these are static local SVG marks. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={school.src}
              alt={`${school.name} logo`}
              width={112}
              height={36}
              loading="lazy"
              decoding="async"
              className="school-logo-img h-7 max-w-[7.5rem] object-contain sm:h-8 sm:max-w-32"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
