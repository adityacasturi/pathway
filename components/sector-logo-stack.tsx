import { CompanyLogo } from "@/components/company-logo";
import { cn } from "@/lib/utils";

export interface SectorLogoCompany {
  slug: string;
  name: string;
  websiteUrl: string | null;
}

interface Props {
  companies: SectorLogoCompany[];
  logoSize?: number;
  className?: string;
}

const FAN_ROTATIONS = [-5, -2, 2, 4, -1, 3, 0, 2] as const;
const FAN_LIFT = [-2, 2, -1, 1, 0, -2, 1, 0] as const;

export function SectorLogoStack({ companies, logoSize = 34, className }: Props) {
  if (companies.length === 0) {
    return null;
  }

  const framePadding = 3;
  const frameSize = logoSize + framePadding * 2;
  const overlap = 6;
  const step = companies.length > 1 ? frameSize - overlap : 0;
  const trackWidth = frameSize + step * Math.max(0, companies.length - 1);
  const trackHeight = frameSize + 6;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: trackWidth, height: trackHeight }}
      aria-hidden
    >
      {companies.map((company, index) => {
        const rotation = FAN_ROTATIONS[index % FAN_ROTATIONS.length];
        const lift = FAN_LIFT[index % FAN_LIFT.length];

        return (
          <div
            key={company.slug}
            className={cn(
              "absolute top-1/2 origin-center transition-[transform,left] duration-300 ease-out",
            )}
            style={{
              left: index * step,
              zIndex: companies.length - index,
              transform: `translateY(calc(-50% + ${lift}px)) rotate(${rotation}deg)`,
            }}
          >
            <div
              className={cn(
                "flex items-center justify-center rounded-md bg-card",
                "shadow-[0_4px_10px_-6px_color-mix(in_oklab,var(--ink)_40%,transparent),0_0_0_1px_color-mix(in_oklab,var(--ink)_8%,transparent)]",
                "ring-2 ring-card",
                "transition-transform duration-300 ease-out",
                "[&_img]:block [&_>div]:leading-none",
                index === 0 && "group-hover/card:rotate-[-7deg] group-hover/card:-translate-x-0.5",
                index === 1 && "group-hover/card:rotate-[-3deg]",
                index === 2 && "group-hover/card:rotate-[3deg]",
                index >= 3 && "group-hover/card:translate-x-0.5",
              )}
              style={{ width: frameSize, height: frameSize }}
            >
              <CompanyLogo
                company={company.name}
                companySlug={company.slug}
                websiteUrl={company.websiteUrl}
                size={logoSize}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const SECTOR_LOGO_STACK_HEIGHT = 46;
