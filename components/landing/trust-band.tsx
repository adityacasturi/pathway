import { OfferWall } from "@/components/landing/offer-wall";
import { TrustBandHeadline } from "@/components/landing/trust-band-headline";
import { pageMainPadding, pageWidths } from "@/components/ui/page";
import { cn } from "@/lib/utils";

export function TrustBand() {
  return (
    <section
      className={cn("lp-trust mx-auto w-full", pageWidths.xl, pageMainPadding)}
      aria-label="Social proof"
    >
      <div className="lp-trust-companies">
        <div className="lp-trust-copy mx-auto mb-7">
          <TrustBandHeadline />
        </div>
        <OfferWall />
      </div>
    </section>
  );
}
