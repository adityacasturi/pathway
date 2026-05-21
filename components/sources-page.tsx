import { CompanyLogo } from "@/components/company-logo";
import { PageHeader, PageMain, PageSection, PageShell } from "@/components/ui/page";

export type SourceStatus = "healthy" | "pending" | "failing" | "disabled";

export interface CompanySourceSummary {
  id: string;
  companyName: string;
  enabled: boolean;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  lastErrorCode: string | null;
  trackedInternships: number;
}

interface Props {
  sources: CompanySourceSummary[];
}

export function SourcesPage({ sources }: Props) {
  const totalTracked = sources.reduce((sum, source) => sum + source.trackedInternships, 0);
  const healthy = sources.filter((source) => sourceStatus(source) === "healthy").length;

  return (
    <PageShell>
      <PageMain width="lg">
        <PageHeader title="Boards">
          <p className="mt-1 text-sm text-muted-foreground">
            {sources.length.toLocaleString()} active company boards · {totalTracked.toLocaleString()} tracked engineering internships
          </p>
        </PageHeader>

        <PageSection
          label="Sources"
          title="Company job boards"
          meta={`${healthy.toLocaleString()} healthy`}
          contentClassName="py-0"
        >
          {sources.length === 0 ? (
            <div className="py-24 text-center text-[15px] text-muted-foreground">
              No sources are configured.
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--rule)" }}>
              {sources.map((source) => (
                <SourceRow key={source.id} source={source} />
              ))}
            </ul>
          )}
        </PageSection>
      </PageMain>
    </PageShell>
  );
}

function SourceRow({ source }: { source: CompanySourceSummary }) {
  const status = sourceStatus(source);

  return (
    <li className="smooth-surface hover:bg-[color-mix(in_oklab,var(--ink)_3%,transparent)]">
      <div className="grid min-h-[52px] grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 px-2 py-2">
        <CompanyLogo company={source.companyName} size={30} />

        <div className="min-w-0 flex items-center gap-2.5">
          <p className="truncate text-[14px] font-medium text-foreground">{source.companyName}</p>
          <StatusPill status={status} />
        </div>

        <div className="text-right">
          <p className="tabular text-[16px] leading-none font-semibold text-foreground">
            {source.trackedInternships.toLocaleString()}
          </p>
          <p className="text-[10px] leading-none text-muted-foreground">open</p>
        </div>
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: SourceStatus }) {
  return (
    <span className={`source-status-pill source-status-pill--${status}`}>
      {status}
    </span>
  );
}

function sourceStatus(source: CompanySourceSummary): SourceStatus {
  if (!source.enabled) return "disabled";
  if (source.consecutiveFailures > 0 || source.lastErrorCode) return "failing";
  if (!source.lastSuccessAt) return "pending";
  return "healthy";
}
