import { SkeletonBlock } from "@/components/ui/loading-indicator";

/**
 * Skeletons that match each top-level route's shell. Used in two places:
 *   1. app/<route>/loading.tsx — shown by Next during RSC streaming once
 *      navigation has committed.
 *   2. <NavLink> — portalled over the current page the instant the user
 *      clicks a nav link, so the old page doesn't linger while the RSC
 *      payload is still in flight (see useLinkStatus).
 */

export function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-18 sm:pt-20 lg:pt-24 pb-20">
        <div className="mb-10 flex items-center justify-between">
          <SkeletonBlock className="h-10 w-28" />
          <SkeletonBlock className="h-10 w-10 rounded-md" />
        </div>

        <div className="mb-12">
          <SkeletonBlock className="h-3 w-24 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-[72px] rounded-md" />
            ))}
          </div>
        </div>

        <div>
          <SkeletonBlock className="h-3 w-40 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-[68px] w-full rounded-md" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-18 sm:pt-20 lg:pt-24 pb-20">
        <div className="flex items-center justify-between mb-8">
          <SkeletonBlock className="h-10 w-56" />
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-11 w-24 rounded-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5 mb-10">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-[72px] rounded-md" />
          ))}
        </div>

        <SkeletonBlock className="h-12 w-full max-w-md mb-6 rounded-sm" />

        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-[68px] w-full rounded-md" />
          ))}
        </div>
      </main>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-18 sm:pt-20 lg:pt-24 pb-20">
        <div className="mb-10 flex items-center justify-between">
          <SkeletonBlock className="h-10 w-32" />
          <SkeletonBlock className="h-11 w-28 rounded-sm" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-10">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-[138px] rounded-md" />
          ))}
        </div>

        <SkeletonBlock className="h-[420px] w-full rounded-md mb-10" />

        <div className="grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
          <SkeletonBlock className="h-[320px] rounded-md" />
          <SkeletonBlock className="h-[320px] rounded-md" />
        </div>
      </main>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-12 pt-18 sm:pt-20 lg:pt-24 pb-20">
        <div className="mb-10">
          <SkeletonBlock className="h-10 w-40" />
        </div>

        <div className="space-y-10">
          {Array.from({ length: 3 }).map((_, sectionIdx) => (
            <div key={sectionIdx}>
              <SkeletonBlock className="h-3 w-28 mb-4" />
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonBlock key={i} className="h-16 w-full rounded-md" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export function DiscoverSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-18 sm:pt-20 lg:pt-24 pb-20">
        <div className="mb-8 flex items-center justify-between">
          <SkeletonBlock className="h-10 w-40" />
          <SkeletonBlock className="h-10 w-24 rounded-md" />
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center mb-8">
          <SkeletonBlock className="h-12 flex-1 rounded-sm" />
          <SkeletonBlock className="h-12 w-48 rounded-sm" />
          <SkeletonBlock className="h-12 w-48 rounded-sm" />
        </div>

        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-[68px] w-full rounded-md" />
          ))}
        </div>
      </main>
    </div>
  );
}
