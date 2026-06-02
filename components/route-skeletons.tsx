import { SkeletonBlock } from "@/components/ui/loading-indicator";
import { PageMain, PageShell } from "@/components/ui/page";

/**
 * Skeletons that match each top-level route's shell. They reuse PageShell /
 * PageMain so their width and padding always track the real pages, and are
 * shared by app/<route>/loading.tsx and the fixed nav pending layer so route
 * changes feel intentional even when the destination payload is still
 * streaming. They stay deliberately coarse: enough structure to read as the
 * destination, no attempt to mirror every element.
 */

function HeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="mb-10 flex items-center justify-between gap-4">
      <SkeletonBlock className="h-11 w-44 rounded-lg sm:h-12 sm:w-56" />
      {action ? <SkeletonBlock className="h-10 w-36 shrink-0 rounded-full" /> : null}
    </div>
  );
}

function SectionHeadingSkeleton({ descriptionWidth = "w-56" }: { descriptionWidth?: string }) {
  return (
    <div className="mb-5">
      <SkeletonBlock className="h-5 w-32 rounded" />
      <SkeletonBlock className={`mt-2.5 h-3.5 rounded ${descriptionWidth}`} />
    </div>
  );
}

function SnapshotGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonBlock key={i} className="h-[4.5rem] rounded-xl" />
      ))}
    </div>
  );
}

function RowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock key={i} className="h-[68px] w-full rounded-xl" />
      ))}
    </div>
  );
}

function MetricGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonBlock key={i} className="h-[5.5rem] rounded-xl" />
      ))}
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <PageShell>
      <PageMain width="xl">
        <HeaderSkeleton action />

        <section className="mb-12">
          <SectionHeadingSkeleton />
          <SnapshotGridSkeleton />
        </section>

        <section className="mb-12">
          <SectionHeadingSkeleton descriptionWidth="w-64" />
          <RowsSkeleton count={3} />
        </section>

        <section className="mb-12">
          <SectionHeadingSkeleton descriptionWidth="w-72" />
          <RowsSkeleton count={3} />
        </section>
      </PageMain>
    </PageShell>
  );
}

export function DashboardSkeleton() {
  return (
    <PageShell>
      <PageMain width="xl">
        <HeaderSkeleton action />

        <div className="mb-8">
          <SnapshotGridSkeleton />
        </div>

        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
          <SkeletonBlock className="h-12 flex-1 rounded-xl" />
          <SkeletonBlock className="h-12 w-32 rounded-xl" />
        </div>

        <RowsSkeleton count={8} />
      </PageMain>
    </PageShell>
  );
}

export function StatsSkeleton() {
  return (
    <PageShell>
      <PageMain width="xl">
        <HeaderSkeleton />

        <section className="mb-12">
          <SectionHeadingSkeleton />
          <SnapshotGridSkeleton />
        </section>

        <section className="mb-12">
          <SectionHeadingSkeleton descriptionWidth="w-64" />
          <MetricGridSkeleton />
        </section>

        <section className="mb-12">
          <SectionHeadingSkeleton descriptionWidth="w-72" />
          <MetricGridSkeleton />
        </section>

        <div className="mb-12 grid gap-3 lg:grid-cols-2">
          <SkeletonBlock className="h-[300px] rounded-xl" />
          <SkeletonBlock className="h-[300px] rounded-xl" />
        </div>

        <section className="mb-12">
          <SectionHeadingSkeleton descriptionWidth="w-40" />
          <SkeletonBlock className="h-[360px] w-full rounded-xl" />
        </section>
      </PageMain>
    </PageShell>
  );
}

export function SettingsSkeleton() {
  return (
    <PageShell>
      <PageMain width="md">
        <HeaderSkeleton />

        <div className="space-y-14">
          {Array.from({ length: 2 }).map((_, sectionIdx) => (
            <section key={sectionIdx}>
              <SkeletonBlock className="mb-5 h-6 w-32 rounded" />
              <div
                className="flex flex-col gap-2 border-y py-5"
                style={{ borderColor: "var(--rule)" }}
              >
                {Array.from({ length: 2 }).map((_, i) => (
                  <SkeletonBlock key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            </section>
          ))}
        </div>
      </PageMain>
    </PageShell>
  );
}

function CompanyCardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <SkeletonBlock className="h-[76px] w-full rounded-lg" />
        </li>
      ))}
    </ul>
  );
}

export function DiscoverSkeleton() {
  return (
    <PageShell>
      <PageMain width="xl">
        <HeaderSkeleton />

        <SkeletonBlock className="mb-8 h-12 w-full rounded-xl" />

        <div className="mb-10 flex flex-wrap gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>

        {Array.from({ length: 2 }).map((_, sectionIdx) => (
          <section key={sectionIdx} className="mb-12">
            <SectionHeadingSkeleton descriptionWidth="w-64" />
            <CompanyCardGridSkeleton />
          </section>
        ))}
      </PageMain>
    </PageShell>
  );
}

export const DiscoverBoardSkeleton = DiscoverSkeleton;

export function LiveSkeleton() {
  return (
    <PageShell>
      <PageMain width="xl">
        <HeaderSkeleton action />

        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center">
          <SkeletonBlock className="h-12 flex-1 rounded-xl" />
          <SkeletonBlock className="h-12 w-32 rounded-xl" />
        </div>

        <div className="mb-3 flex justify-end">
          <SkeletonBlock className="h-3.5 w-24 rounded" />
        </div>

        <RowsSkeleton count={8} />
      </PageMain>
    </PageShell>
  );
}

function AlertsToggleRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0 flex-1">
        <SkeletonBlock className="h-5 w-32 rounded" />
        <SkeletonBlock className="mt-2.5 h-3.5 w-72 rounded" />
      </div>
      <SkeletonBlock className="h-6 w-11 shrink-0 rounded-full" />
    </div>
  );
}

export function AlertsSkeleton() {
  return (
    <PageShell>
      <PageMain>
        <div className="mb-10">
          <SkeletonBlock className="h-11 w-36 rounded-lg sm:h-12 sm:w-44" />
          <SkeletonBlock className="mt-3 h-3.5 w-80 rounded" />
        </div>

        <div className="max-w-5xl space-y-10">
          <AlertsToggleRowSkeleton />

          <section className="space-y-8">
            <AlertsToggleRowSkeleton />

            <div>
              <SkeletonBlock className="mb-3 h-3.5 w-24 rounded" />
              <SkeletonBlock className="h-12 w-full rounded-xl" />
            </div>

            <div>
              <SkeletonBlock className="mb-1 h-3.5 w-32 rounded" />
              <SkeletonBlock className="mb-4 h-3.5 w-80 rounded" />
              <ul className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i}>
                    <SkeletonBlock className="h-[152px] w-full rounded-2xl" />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </PageMain>
    </PageShell>
  );
}
