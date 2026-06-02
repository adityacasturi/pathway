type OfferCompany = { name: string; slug: string };

// Logos are downloaded into /public/company-logos so the landing page never
// hits the authenticated /api/logo proxy (which 401s for anonymous visitors
// and would otherwise invite abuse). See public/company-logos/.
const ROW_ONE: OfferCompany[] = [
  { name: "Google", slug: "google" },
  { name: "Meta", slug: "meta" },
  { name: "Amazon", slug: "amazon" },
  { name: "Microsoft", slug: "microsoft" },
  { name: "Apple", slug: "apple" },
  { name: "Nvidia", slug: "nvidia" },
  { name: "Stripe", slug: "stripe" },
  { name: "Databricks", slug: "databricks" },
  { name: "Jane Street", slug: "jane-street" },
  { name: "Citadel", slug: "citadel" },
  { name: "Palantir", slug: "palantir" },
  { name: "Snowflake", slug: "snowflake" },
];

const ROW_TWO: OfferCompany[] = [
  { name: "Goldman Sachs", slug: "goldman-sachs" },
  { name: "Morgan Stanley", slug: "morgan-stanley" },
  { name: "Two Sigma", slug: "two-sigma" },
  { name: "Bloomberg", slug: "bloomberg" },
  { name: "Salesforce", slug: "salesforce" },
  { name: "Uber", slug: "uber" },
  { name: "Airbnb", slug: "airbnb" },
  { name: "Coinbase", slug: "coinbase" },
  { name: "Tesla", slug: "tesla" },
  { name: "Netflix", slug: "netflix" },
  { name: "Ramp", slug: "ramp" },
  { name: "Figma", slug: "figma" },
];

function OfferRow({ companies, reverse }: { companies: OfferCompany[]; reverse?: boolean }) {
  const items = [...companies, ...companies];
  return (
    <div className="offer-wall-row">
      <div className={`offer-wall-track ${reverse ? "offer-wall-track--reverse" : ""}`}>
        {items.map((company, index) => (
          <div
            key={`${company.slug}-${index}`}
            className="offer-wall-chip"
            aria-hidden={index >= companies.length}
          >
            {/* Static local asset, no proxy or logo.dev at request time. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/company-logos/${company.slug}.png`}
              alt={index >= companies.length ? "" : `${company.name} logo`}
              width={26}
              height={26}
              loading="lazy"
              decoding="async"
              className="offer-wall-chip-logo"
            />
            <span className="offer-wall-chip-name">{company.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OfferWall() {
  return (
    <div className="offer-wall school-logo-fade">
      <OfferRow companies={ROW_ONE} />
      <OfferRow companies={ROW_TWO} reverse />
    </div>
  );
}
