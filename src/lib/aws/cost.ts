import "server-only";

import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetCostForecastCommand,
} from "@aws-sdk/client-cost-explorer";

/**
 * What AWS is charging Gwave for, and why.
 *
 * Everything here comes from Cost Explorer, which is the only API that knows
 * the actual billed amounts (the console's "Billing" page reads the same data).
 * Two things shape this module:
 *
 *  1. **Cost Explorer is itself billed at $0.01 per request.** A dashboard that
 *     re-queried on every page load would quietly add its own line to the bill,
 *     which would be a bad joke. So the results are cached in-process for six
 *     hours and the UI says when they were fetched. Three requests per refresh
 *     ≈ $0.03; at most four refreshes a day that is about $0.12/month.
 *  2. **Cost Explorer only lives in us-east-1**, regardless of where the
 *     workload runs. The region below is not a mistake.
 *
 * A missing `ce:GetCostAndUsage` permission is the expected first-run state —
 * the EC2 instance role doesn't have billing access by default — so that comes
 * back as a typed error the page turns into "add this IAM policy", not a 500.
 */

export interface ServiceCost {
  service: string;
  /** This month so far, USD. */
  amount: number;
  /** Same service, the whole of last month, for the "up or down" arrow. */
  previous: number;
}

export interface DailyCost {
  date: string;
  amount: number;
}

export interface AwsCostReport {
  currency: string;
  monthLabel: string;
  monthToDate: number;
  previousMonth: number;
  /** Cost Explorer's own projection for the full current month, when available. */
  forecast: number | null;
  services: ServiceCost[];
  daily: DailyCost[];
  fetchedAt: string;
  /** Human-readable reason the report is empty (IAM, usually). */
  error: string | null;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

let cache: { at: number; report: AwsCostReport } | null = null;
const CACHE_MS = 6 * 60 * 60 * 1000;

export async function getAwsCostReport(
  force = false,
): Promise<AwsCostReport> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.report;
  }

  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const prevStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  // Cost Explorer's End is exclusive, so "tomorrow" is what includes today.
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const base: AwsCostReport = {
    currency: "USD",
    monthLabel: monthStart.toISOString().slice(0, 7),
    monthToDate: 0,
    previousMonth: 0,
    forecast: null,
    services: [],
    daily: [],
    fetchedAt: new Date().toISOString(),
    error: null,
  };

  try {
    const client = new CostExplorerClient({ region: "us-east-1" });

    // One call covers both months: MONTHLY granularity over last month → today
    // returns two buckets, so the comparison costs nothing extra.
    const byService = await client.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: ymd(prevStart), End: ymd(tomorrow) },
        Granularity: "MONTHLY",
        Metrics: ["UnblendedCost"],
        GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
      }),
    );

    const current = new Map<string, number>();
    const previous = new Map<string, number>();
    let currency = "USD";
    for (const period of byService.ResultsByTime ?? []) {
      const start = period.TimePeriod?.Start ?? "";
      const target = start >= ymd(monthStart) ? current : previous;
      for (const g of period.Groups ?? []) {
        const name = g.Keys?.[0] ?? "Other";
        const metric = g.Metrics?.UnblendedCost;
        const amount = Number(metric?.Amount ?? 0);
        if (metric?.Unit) currency = metric.Unit;
        target.set(name, (target.get(name) ?? 0) + amount);
      }
    }

    const services: ServiceCost[] = [...current.entries()]
      .map(([service, amount]) => ({
        service,
        amount,
        previous: previous.get(service) ?? 0,
      }))
      // A service that stopped being used this month is still worth seeing.
      .concat(
        [...previous.entries()]
          .filter(([service]) => !current.has(service))
          .map(([service, amount]) => ({ service, amount: 0, previous: amount })),
      )
      .filter((s) => s.amount > 0.0000001 || s.previous > 0.0000001)
      .sort((a, b) => b.amount - a.amount || b.previous - a.previous);

    // Daily totals for the trend bars — one more request.
    const byDay = await client.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: ymd(thirtyDaysAgo), End: ymd(tomorrow) },
        Granularity: "DAILY",
        Metrics: ["UnblendedCost"],
      }),
    );
    const daily: DailyCost[] = (byDay.ResultsByTime ?? []).map((p) => ({
      date: p.TimePeriod?.Start ?? "",
      amount: Number(p.Total?.UnblendedCost?.Amount ?? 0),
    }));

    // Forecast needs enough history and a future window; a brand-new account
    // or the last day of the month both make it fail, and neither is an error
    // worth showing.
    let forecast: number | null = null;
    if (ymd(tomorrow) < ymd(monthEnd)) {
      try {
        const f = await client.send(
          new GetCostForecastCommand({
            TimePeriod: { Start: ymd(tomorrow), End: ymd(monthEnd) },
            Granularity: "MONTHLY",
            Metric: "UNBLENDED_COST",
          }),
        );
        const rest = Number(f.Total?.Amount ?? 0);
        forecast =
          rest + [...current.values()].reduce((n, v) => n + v, 0);
      } catch {
        forecast = null;
      }
    }

    const report: AwsCostReport = {
      ...base,
      currency,
      monthToDate: [...current.values()].reduce((n, v) => n + v, 0),
      previousMonth: [...previous.values()].reduce((n, v) => n + v, 0),
      forecast,
      services,
      daily,
      fetchedAt: new Date().toISOString(),
      error: null,
    };
    cache = { at: Date.now(), report };
    return report;
  } catch (e) {
    const message = (e as Error).message || "Cost Explorer request failed.";
    const report = { ...base, error: message };
    // Cache failures briefly too, so a permission error doesn't retry (and bill)
    // on every page load.
    cache = { at: Date.now() - CACHE_MS + 5 * 60 * 1000, report };
    return report;
  }
}

/**
 * Why Gwave pays for a given AWS service, in one honest line each.
 *
 * The console tells you *what* you were charged; nobody tells you *why your
 * app* is charged, which is the thing you need to decide whether a line is
 * worth it. Keys are matched as substrings against the Cost Explorer service
 * name, longest first, so "Amazon Elastic Compute Cloud - Compute" and
 * "EC2 - Other" land on different entries.
 */
interface ServiceNote {
  /** What Gwave runs on it. */
  what: string;
  /** What the meter actually counts. */
  billedFor: string;
  /** The lever that would reduce it. */
  lever: string;
}

const NOTES: [string, ServiceNote][] = [
  [
    "Elastic Compute Cloud - Compute",
    {
      what: "The EC2 box that runs the Next.js container, PostgREST, Realtime and the coturn TURN relay.",
      billedFor: "Instance-hours — charged for every hour it is switched on, whether or not anyone is using the site.",
      lever: "A smaller instance size, or a Savings Plan / Reserved Instance for a box that never turns off.",
    },
  ],
  [
    "EC2 - Other",
    {
      what: "The disks and addresses attached to that box: EBS volumes, snapshots, the Elastic IP, data transfer between zones.",
      billedFor: "GB-month of EBS storage plus any idle Elastic IP; snapshots are billed until deleted.",
      lever: "Delete stale snapshots and unattached volumes; release Elastic IPs you no longer point at anything.",
    },
  ],
  [
    "Relational Database Service",
    {
      what: "The Postgres database — every post, message, order and map pin in the app.",
      billedFor: "Instance-hours + provisioned storage GB-month + backup storage beyond the free allowance.",
      lever: "Right-size the instance, trim the backup retention window, and drop tables that only hold logs.",
    },
  ],
  [
    "Simple Storage Service",
    {
      what: "S3 — user photos and video, messenger attachments, audio, books, payment slips, live recordings.",
      billedFor: "GB stored per month, plus a charge per PUT/GET request. Storage grows and never shrinks by itself.",
      lever: "Lifecycle rules that move old media to Infrequent Access or Glacier, and deleting orphaned uploads.",
    },
  ],
  [
    "CloudFront",
    {
      what: "The CDN that serves every image and video in the app and on the website.",
      billedFor: "GB transferred out to users plus per-request fees — this is the line that grows with traffic.",
      lever: "Longer cache TTLs, smaller image sizes, and serving video at a lower bitrate.",
    },
  ],
  [
    "Elastic Container Registry",
    {
      what: "Where each deploy's Docker image is stored before EC2 pulls it.",
      billedFor: "GB-month of stored images — every deploy adds another one until it is cleaned up.",
      lever: "A lifecycle policy that keeps only the newest handful of image tags.",
    },
  ],
  [
    "Interactive Video Service",
    {
      what: "IVS — the app's live broadcasting (phone → RTMPS) and the recorded replays.",
      billedFor: "Input hours while someone is broadcasting plus output hours per viewer — the most traffic-sensitive line on the bill.",
      lever: "Lower channel quality for casual streams, and ending dead channels rather than leaving them live.",
    },
  ],
  [
    "Kinesis Video",
    {
      what: "The CCTV feature — camera streams ingested and stored.",
      billedFor: "GB ingested, GB stored, and GB consumed by viewers.",
      lever: "Shorter retention on camera streams; turn off cameras nobody watches.",
    },
  ],
  [
    "Cognito",
    {
      what: "Sign-in — the user pool that holds every account and issues the app's tokens.",
      billedFor: "Monthly active users above the free tier, counted per user who authenticates in a month.",
      lever: "Nothing much: this scales with real users, which is the good kind of cost.",
    },
  ],
  [
    "Simple Notification Service",
    {
      what: "SMS — phone sign-in codes and alerts.",
      billedFor: "Per message sent, and the price differs sharply by destination country.",
      lever: "Rate-limit code resends; prefer push notifications over SMS where the app is installed.",
    },
  ],
  [
    "Simple Email Service",
    {
      what: "Transactional email.",
      billedFor: "Per message sent plus attachment data.",
      lever: "Batch digests instead of one email per event.",
    },
  ],
  [
    "CloudWatch",
    {
      what: "Metrics, logs and alarms — including the S3 storage numbers on the storage page.",
      billedFor: "Ingested log GB, custom metrics, dashboards, and API requests such as GetMetricData.",
      lever: "Shorter log retention, and fewer custom metrics.",
    },
  ],
  [
    "Cost Explorer",
    {
      what: "This very page — the billing API it reads.",
      billedFor: "$0.01 per API request. The report is cached for six hours precisely so this line stays near zero.",
      lever: "Refresh less often. There is no cheaper source for actual billed amounts.",
    },
  ],
  [
    "Key Management Service",
    {
      what: "Encryption keys used by S3, RDS and Secrets Manager.",
      billedFor: "Per key per month plus per API request.",
      lever: "Use the AWS-managed default keys rather than one customer key per service.",
    },
  ],
  [
    "Secrets Manager",
    {
      what: "Stored credentials.",
      billedFor: "Per secret per month plus per retrieval.",
      lever: "Fold rarely-rotated values into the EC2 env file instead of a paid secret.",
    },
  ],
  [
    "Route 53",
    {
      what: "DNS for gwave.cc.",
      billedFor: "Per hosted zone per month plus per million queries.",
      lever: "Nothing worth doing — this is a fixed dollar or two.",
    },
  ],
  [
    "Systems Manager",
    {
      what: "SSM — how the deploy workflow runs commands on the EC2 box without SSH.",
      billedFor: "Mostly free; advanced parameters and on-prem instances are what cost.",
      lever: "Keep using standard parameters.",
    },
  ],
  [
    "Data Transfer",
    {
      what: "Bytes leaving AWS that are not already billed through CloudFront.",
      billedFor: "GB out to the internet and between availability zones.",
      lever: "Keep services in one zone and serve public media through CloudFront rather than straight from S3.",
    },
  ],
  [
    "Chime SDK",
    {
      what: "Reserved for messenger calls (currently WebRTC + coturn, so this should read zero).",
      billedFor: "Attendee-minutes.",
      lever: "It is not switched on — a non-zero figure here is worth investigating.",
    },
  ],
  [
    "Tax",
    {
      what: "Sales tax / VAT applied to the bill.",
      billedFor: "A percentage of everything above it.",
      lever: "Nothing — it follows the rest of the bill down.",
    },
  ],
];

export function costNote(service: string): ServiceNote | null {
  const found = NOTES.filter(([key]) =>
    service.toLowerCase().includes(key.toLowerCase()),
  ).sort((a, b) => b[0].length - a[0].length)[0];
  return found ? found[1] : null;
}
