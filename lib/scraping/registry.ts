import { createBloombergAdapter } from "./adapters/bloomberg.ts";
import { createElectronicArtsAdapter } from "./adapters/electronic-arts.ts";
import { createAmdAdapter } from "./adapters/amd.ts";
import { createAtlassianAdapter } from "./adapters/atlassian.ts";
import { createGithubAdapter } from "./adapters/github.ts";
import { createSlackAdapter } from "./adapters/slack.ts";
import { createSplunkAdapter } from "./adapters/splunk.ts";
import { createSapAdapter } from "./adapters/sap.ts";
import { createTeradataAdapter } from "./adapters/teradata.ts";
import { createEtsyAdapter } from "./adapters/etsy.ts";
import { createGeneralDynamicsAdapter } from "./adapters/general-dynamics.ts";
import { createBaeSystemsAdapter } from "./adapters/bae-systems.ts";
import { createL3HarrisAdapter } from "./adapters/l3harris.ts";
import { createArmAdapter } from "./adapters/arm.ts";
import { createSynopsysAdapter } from "./adapters/synopsys.ts";
import { createValveAdapter } from "./adapters/valve.ts";
import { createRivianAdapter } from "./adapters/rivian.ts";
import { createSigAdapter } from "./adapters/sig.ts";
import { createAmazonAdapter } from "./adapters/amazon.ts";
import { createByteDanceAdapter } from "./adapters/bytedance.ts";
import { createAppleAdapter } from "./adapters/apple.ts";
import { createAshbyAdapter } from "./adapters/ashby.ts";
import { createBreezyAdapter } from "./adapters/breezy.ts";
import { createCitadelAdapter } from "./adapters/citadel.ts";
import { createDeShawAdapter } from "./adapters/de-shaw.ts";
import { createFiveRingsAdapter } from "./adapters/five-rings.ts";
import { createChewyAdapter } from "./adapters/chewy.ts";
import { createPeak6Adapter } from "./adapters/peak6.ts";
import { createCitigroupAdapter } from "./adapters/citigroup.ts";
import { createCoinbaseAdapter } from "./adapters/coinbase.ts";
import { createHiringThingAdapter } from "./adapters/hiringthing.ts";
import { createJobviteAdapter } from "./adapters/jobvite.ts";
import { createLockheedMartinAdapter } from "./adapters/lockheed-martin.ts";
import { createMillenniumAdapter } from "./adapters/millennium.ts";
import { createSmartRecruitersAdapter } from "./adapters/smartrecruiters.ts";
import { createLumaAiAdapter } from "./adapters/luma-ai.ts";
import { createModularAdapter } from "./adapters/modular.ts";
import { createReplicateAdapter } from "./adapters/replicate.ts";
import { createSakanaAiAdapter } from "./adapters/sakana-ai.ts";
import { createSurgeAdapter } from "./adapters/surge.ts";
import { createWorkableAdapter } from "./adapters/workable.ts";
import { createRtxAdapter } from "./adapters/rtx.ts";
import { createGoldmanSachsAdapter } from "./adapters/goldman-sachs.ts";
import { createIbmAdapter } from "./adapters/ibm.ts";
import { createNetflixAdapter } from "./adapters/netflix.ts";
import { createOneXTechnologiesAdapter } from "./adapters/one-x-technologies.ts";
import { createXCorpAdapter } from "./adapters/x-corp.ts";
import { createShopifyAdapter } from "./adapters/shopify.ts";
import { createLinkedInAdapter } from "./adapters/linkedin.ts";
import { createIntuitAdapter } from "./adapters/intuit.ts";
import { createOracleAdapter } from "./adapters/oracle.ts";
import { createGoogleAdapter } from "./adapters/google.ts";
import { createGreenhouseAdapter } from "./adapters/greenhouse.ts";
import { createHudsonRiverTradingAdapter } from "./adapters/hudson-river-trading.ts";
import { createJaneStreetAdapter } from "./adapters/jane-street.ts";
import { createJuniperNetworksAdapter } from "./adapters/juniper-networks.ts";
import { createVmwareAdapter } from "./adapters/vmware.ts";
import { createSeagateAdapter } from "./adapters/seagate.ts";
import { createJpmorganChaseAdapter } from "./adapters/jpmorgan-chase.ts";
import { createLeverAdapter } from "./adapters/lever.ts";
import { createMetaAdapter } from "./adapters/meta.ts";
import { createMorganStanleyAdapter } from "./adapters/morgan-stanley.ts";
import { createSalesforceAdapter } from "./adapters/salesforce.ts";
import { createTowerResearchAdapter } from "./adapters/tower-research.ts";
import { createTeslaAdapter } from "./adapters/tesla.ts";
import { createMicrosoftAdapter } from "./adapters/microsoft.ts";
import { createQualcommAdapter } from "./adapters/qualcomm.ts";
import { createNvidiaAdapter } from "./adapters/nvidia.ts";
import { createTwoSigmaAdapter } from "./adapters/two-sigma.ts";
import { createUberAdapter } from "./adapters/uber.ts";
import { createWeightsBiasesAdapter } from "./adapters/weights-biases.ts";
import { createWayfairAdapter } from "./adapters/wayfair.ts";
import { createWorkdayAdapter } from "./adapters/workday.ts";
import type { CompanySourceConfig, ScrapeAdapter } from "./types.ts";

export function buildScrapeAdapter(source: CompanySourceConfig): ScrapeAdapter | null {
  if (source.sourceType === "greenhouse") {
    return createGreenhouseAdapter(source);
  }
  if (source.sourceType === "ashby") {
    return createAshbyAdapter(source);
  }
  if (source.sourceType === "lever") {
    return createLeverAdapter(source);
  }
  if (source.sourceType === "workday") {
    return createWorkdayAdapter(source);
  }
  if (source.sourceType === "nvidia") {
    return createNvidiaAdapter(source);
  }
  if (source.sourceType === "microsoft") {
    return createMicrosoftAdapter(source);
  }
  if (source.sourceType === "google") {
    return createGoogleAdapter(source);
  }
  if (source.sourceType === "jane_street") {
    return createJaneStreetAdapter(source);
  }
  if (source.sourceType === "hudson_river_trading") {
    return createHudsonRiverTradingAdapter(source);
  }
  if (source.sourceType === "apple") {
    return createAppleAdapter(source);
  }
  if (source.sourceType === "citadel") {
    return createCitadelAdapter(source);
  }
  if (source.sourceType === "two_sigma") {
    return createTwoSigmaAdapter(source);
  }
  if (source.sourceType === "amazon") {
    return createAmazonAdapter(source);
  }
  if (source.sourceType === "meta") {
    return createMetaAdapter(source);
  }
  if (source.sourceType === "qualcomm") {
    return createQualcommAdapter(source);
  }
  if (source.sourceType === "uber") {
    return createUberAdapter(source);
  }
  if (source.sourceType === "salesforce") {
    return createSalesforceAdapter(source);
  }
  if (source.sourceType === "de_shaw") {
    return createDeShawAdapter(source);
  }
  if (source.sourceType === "amd") {
    return createAmdAdapter(source);
  }
  if (source.sourceType === "bytedance") {
    return createByteDanceAdapter(source);
  }
  if (source.sourceType === "atlassian") {
    return createAtlassianAdapter(source);
  }
  if (source.sourceType === "tower_research") {
    return createTowerResearchAdapter(source);
  }
  if (source.sourceType === "sig") {
    return createSigAdapter(source);
  }
  if (source.sourceType === "rivian") {
    return createRivianAdapter(source);
  }
  if (source.sourceType === "five_rings") {
    return createFiveRingsAdapter(source);
  }
  if (source.sourceType === "jpmorgan_chase") {
    return createJpmorganChaseAdapter(source);
  }
  if (source.sourceType === "bloomberg") {
    return createBloombergAdapter(source);
  }
  if (source.sourceType === "goldman_sachs") {
    return createGoldmanSachsAdapter(source);
  }
  if (source.sourceType === "oracle") {
    return createOracleAdapter(source);
  }
  if (source.sourceType === "morgan_stanley") {
    return createMorganStanleyAdapter(source);
  }
  if (source.sourceType === "linkedin") {
    return createLinkedInAdapter(source);
  }
  if (source.sourceType === "intuit") {
    return createIntuitAdapter(source);
  }
  if (source.sourceType === "shopify") {
    return createShopifyAdapter(source);
  }
  if (source.sourceType === "netflix") {
    return createNetflixAdapter(source);
  }
  if (source.sourceType === "ibm") {
    return createIbmAdapter(source);
  }
  if (source.sourceType === "coinbase") {
    return createCoinbaseAdapter(source);
  }
  if (source.sourceType === "citigroup") {
    return createCitigroupAdapter(source);
  }
  if (source.sourceType === "rtx") {
    return createRtxAdapter(source);
  }
  if (source.sourceType === "millennium") {
    return createMillenniumAdapter(source);
  }
  if (source.sourceType === "lockheed_martin") {
    return createLockheedMartinAdapter(source);
  }
  if (source.sourceType === "tesla") {
    return createTeslaAdapter(source);
  }
  if (source.sourceType === "workable") {
    return createWorkableAdapter(source);
  }
  if (source.sourceType === "hiringthing") {
    return createHiringThingAdapter(source);
  }
  if (source.sourceType === "jobvite") {
    return createJobviteAdapter(source);
  }
  if (source.sourceType === "replicate") {
    return createReplicateAdapter(source);
  }
  if (source.sourceType === "sakana_ai") {
    return createSakanaAiAdapter(source);
  }
  if (source.sourceType === "luma_ai") {
    return createLumaAiAdapter(source);
  }
  if (source.sourceType === "modular") {
    return createModularAdapter(source);
  }
  if (source.sourceType === "breezy") {
    return createBreezyAdapter(source);
  }
  if (source.sourceType === "surge") {
    return createSurgeAdapter(source);
  }
  if (source.sourceType === "smartrecruiters") {
    return createSmartRecruitersAdapter(source);
  }
  if (source.sourceType === "github") {
    return createGithubAdapter(source);
  }
  if (source.sourceType === "splunk") {
    return createSplunkAdapter(source);
  }
  if (source.sourceType === "slack") {
    return createSlackAdapter(source);
  }
  if (source.sourceType === "juniper_networks") {
    return createJuniperNetworksAdapter(source);
  }
  if (source.sourceType === "vmware") {
    return createVmwareAdapter(source);
  }
  if (source.sourceType === "sap") {
    return createSapAdapter(source);
  }
  if (source.sourceType === "seagate") {
    return createSeagateAdapter(source);
  }
  if (source.sourceType === "teradata") {
    return createTeradataAdapter(source);
  }
  if (source.sourceType === "l3harris") {
    return createL3HarrisAdapter(source);
  }
  if (source.sourceType === "arm") {
    return createArmAdapter(source);
  }
  if (source.sourceType === "synopsys") {
    return createSynopsysAdapter(source);
  }
  if (source.sourceType === "valve") {
    return createValveAdapter(source);
  }
  if (source.sourceType === "chewy") {
    return createChewyAdapter(source);
  }
  if (source.sourceType === "bae_systems") {
    return createBaeSystemsAdapter(source);
  }
  if (source.sourceType === "etsy") {
    return createEtsyAdapter(source);
  }
  if (source.sourceType === "electronic_arts") {
    return createElectronicArtsAdapter(source);
  }
  if (source.sourceType === "wayfair") {
    return createWayfairAdapter(source);
  }
  if (source.sourceType === "peak6") {
    return createPeak6Adapter(source);
  }
  if (source.sourceType === "general_dynamics") {
    return createGeneralDynamicsAdapter(source);
  }
  if (source.sourceType === "weights_biases") {
    return createWeightsBiasesAdapter(source);
  }
  if (source.sourceType === "one_x_technologies") {
    return createOneXTechnologiesAdapter(source);
  }
  if (source.sourceType === "x_corp") {
    return createXCorpAdapter(source);
  }
  return null;
}
