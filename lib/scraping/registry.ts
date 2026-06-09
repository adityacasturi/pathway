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
import { createTwoSigmaAdapter } from "./adapters/two-sigma.ts";
import { createUberAdapter } from "./adapters/uber.ts";
import { createWeightsBiasesAdapter } from "./adapters/weights-biases.ts";
import { createWayfairAdapter } from "./adapters/wayfair.ts";
import { createWorkdayAdapter } from "./adapters/workday.ts";
import { createPinpointAdapter } from "./adapters/pinpoint.ts";
import { createRipplingAdapter } from "./adapters/rippling.ts";
import type { CompanySourceConfig, ScrapeAdapter, SourceType } from "./types.ts";

type AdapterFactory = (source: CompanySourceConfig) => ScrapeAdapter;

const ADAPTER_FACTORIES = {
  greenhouse: createGreenhouseAdapter,
  ashby: createAshbyAdapter,
  lever: createLeverAdapter,
  workday: createWorkdayAdapter,
  microsoft: createMicrosoftAdapter,
  google: createGoogleAdapter,
  jane_street: createJaneStreetAdapter,
  hudson_river_trading: createHudsonRiverTradingAdapter,
  apple: createAppleAdapter,
  citadel: createCitadelAdapter,
  two_sigma: createTwoSigmaAdapter,
  amazon: createAmazonAdapter,
  meta: createMetaAdapter,
  qualcomm: createQualcommAdapter,
  uber: createUberAdapter,
  salesforce: createSalesforceAdapter,
  de_shaw: createDeShawAdapter,
  tesla: createTeslaAdapter,
  amd: createAmdAdapter,
  bytedance: createByteDanceAdapter,
  atlassian: createAtlassianAdapter,
  tower_research: createTowerResearchAdapter,
  sig: createSigAdapter,
  rivian: createRivianAdapter,
  five_rings: createFiveRingsAdapter,
  jpmorgan_chase: createJpmorganChaseAdapter,
  bloomberg: createBloombergAdapter,
  goldman_sachs: createGoldmanSachsAdapter,
  oracle: createOracleAdapter,
  morgan_stanley: createMorganStanleyAdapter,
  linkedin: createLinkedInAdapter,
  intuit: createIntuitAdapter,
  shopify: createShopifyAdapter,
  netflix: createNetflixAdapter,
  ibm: createIbmAdapter,
  coinbase: createCoinbaseAdapter,
  citigroup: createCitigroupAdapter,
  millennium: createMillenniumAdapter,
  lockheed_martin: createLockheedMartinAdapter,
  workable: createWorkableAdapter,
  hiringthing: createHiringThingAdapter,
  surge: createSurgeAdapter,
  smartrecruiters: createSmartRecruitersAdapter,
  github: createGithubAdapter,
  splunk: createSplunkAdapter,
  slack: createSlackAdapter,
  jobvite: createJobviteAdapter,
  juniper_networks: createJuniperNetworksAdapter,
  vmware: createVmwareAdapter,
  sap: createSapAdapter,
  teradata: createTeradataAdapter,
  seagate: createSeagateAdapter,
  l3harris: createL3HarrisAdapter,
  arm: createArmAdapter,
  valve: createValveAdapter,
  bae_systems: createBaeSystemsAdapter,
  chewy: createChewyAdapter,
  electronic_arts: createElectronicArtsAdapter,
  etsy: createEtsyAdapter,
  peak6: createPeak6Adapter,
  wayfair: createWayfairAdapter,
  general_dynamics: createGeneralDynamicsAdapter,
  sakana_ai: createSakanaAiAdapter,
  replicate: createReplicateAdapter,
  luma_ai: createLumaAiAdapter,
  modular: createModularAdapter,
  breezy: createBreezyAdapter,
  weights_biases: createWeightsBiasesAdapter,
  one_x_technologies: createOneXTechnologiesAdapter,
  synopsys: createSynopsysAdapter,
  x_corp: createXCorpAdapter,
  pinpoint: createPinpointAdapter,
  rippling: createRipplingAdapter,
} satisfies Record<SourceType, AdapterFactory>;

export const REGISTERED_SOURCE_TYPES = Object.keys(ADAPTER_FACTORIES) as SourceType[];

export function buildScrapeAdapter(source: CompanySourceConfig): ScrapeAdapter {
  return ADAPTER_FACTORIES[source.sourceType](source);
}
