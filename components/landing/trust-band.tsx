import { OfferWall } from "@/components/landing/offer-wall";
import { pageMainPadding, pageWidths } from "@/components/ui/page";
import { cn } from "@/lib/utils";

export function TrustBand() {
  return (
    <section
      className={cn("lp-trust mx-auto w-full", pageWidths.xl, pageMainPadding)}
      aria-label="Social proof"
    >
      <div className="lp-trust-companies">
        <div className="lp-section-head lp-section-head--center mb-10">
          <h2 className="display-serif text-[2rem] text-foreground sm:text-[2.6rem]">
            Find roles at 400+ companies across 34 industries.
          </h2>
        </div>
        <OfferWall />
      </div>
    </section>
  );
}
