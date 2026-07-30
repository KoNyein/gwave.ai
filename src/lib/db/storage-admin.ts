import "server-only";

import {
  CloudWatchClient,
  GetMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";

import { createAdminClient } from "@/lib/data/admin";

/**
 * "How much data does the system actually hold, and where does it live?"
 *
 * Two places, and they are billed differently, so the dashboard shows them
 * separately:
 *
 *  1. **Postgres on RDS** — every row of every feature. Sizes come from
 *     `admin_storage_tables()` / `admin_storage_summary()` (db/sql/admin-storage.sql),
 *     because PostgREST serves rows, not catalogue views, and has no GROUP BY.
 *  2. **S3** — the bytes users actually upload: photos, video, voice clips,
 *     audiobooks, IVS recordings. Sizes come from the CloudWatch daily storage
 *     metrics rather than by listing objects, which on a media bucket would
 *     mean hundreds of thousands of API calls per page load.
 *
 * Everything degrades to null/empty rather than throwing: a missing IAM
 * permission should show as "grant this policy", not a 500.
 */

export interface TableStorage {
  table: string;
  rows: number;
  totalBytes: number;
  heapBytes: number;
  indexBytes: number;
  toastBytes: number;
}

export interface DatabaseStorage {
  name: string;
  totalBytes: number;
  tableCount: number;
  indexCount: number;
  largestTable: string | null;
  largestTableBytes: number;
  tables: TableStorage[];
  /** Set when the SQL functions haven't been applied yet. */
  error: string | null;
}

interface SummaryRow {
  database_name: string;
  database_bytes: number;
  table_count: number;
  index_count: number;
  largest_table: string | null;
  largest_table_bytes: number;
}

interface TableRow {
  table_name: string;
  row_estimate: number;
  total_bytes: number;
  heap_bytes: number;
  index_bytes: number;
  toast_bytes: number;
}

export async function getDatabaseStorage(): Promise<DatabaseStorage> {
  const db = createAdminClient();
  const empty: DatabaseStorage = {
    name: "gwave",
    totalBytes: 0,
    tableCount: 0,
    indexCount: 0,
    largestTable: null,
    largestTableBytes: 0,
    tables: [],
    error: null,
  };

  const [summaryRes, tablesRes] = await Promise.all([
    db.rpc("admin_storage_summary"),
    db.rpc("admin_storage_tables"),
  ]);

  if (summaryRes.error || tablesRes.error) {
    return {
      ...empty,
      error:
        "db/sql/admin-storage.sql ကို RDS တွင် run ပြီး postgrest ကို restart လုပ်ရန် လိုအပ်ပါသည်။",
    };
  }

  // PostgREST returns a set-returning function as an array of rows.
  const summary = (summaryRes.data as SummaryRow[] | null)?.[0];
  const rows = (tablesRes.data as TableRow[] | null) ?? [];

  return {
    name: summary?.database_name ?? "gwave",
    totalBytes: Number(summary?.database_bytes ?? 0),
    tableCount: Number(summary?.table_count ?? rows.length),
    indexCount: Number(summary?.index_count ?? 0),
    largestTable: summary?.largest_table ?? null,
    largestTableBytes: Number(summary?.largest_table_bytes ?? 0),
    tables: rows.map((r) => ({
      table: r.table_name,
      rows: Number(r.row_estimate ?? 0),
      totalBytes: Number(r.total_bytes ?? 0),
      heapBytes: Number(r.heap_bytes ?? 0),
      indexBytes: Number(r.index_bytes ?? 0),
      toastBytes: Number(r.toast_bytes ?? 0),
    })),
    error: null,
  };
}

export interface BucketStorage {
  bucket: string;
  /** What the app keeps in it, in one line. */
  purpose: string;
  bytes: number | null;
  objects: number | null;
}

export interface S3Storage {
  buckets: BucketStorage[];
  totalBytes: number;
  totalObjects: number;
  /** Set when CloudWatch refused — usually a missing IAM permission. */
  error: string | null;
}

/** Which buckets exist is an env question, so read it rather than hardcoding. */
function configuredBuckets(): { bucket: string; purpose: string }[] {
  const entries: { bucket: string | undefined; purpose: string }[] = [
    {
      bucket: process.env.AWS_S3_MEDIA_BUCKET,
      purpose: "Post photos/videos, avatars, covers, audio, books, mine + place photos",
    },
    {
      bucket: process.env.AWS_S3_CHAT_BUCKET,
      purpose: "Messenger attachments — photos, video, voice clips, documents",
    },
    {
      bucket: process.env.AWS_S3_SLIPS_BUCKET,
      purpose: "KPay payment slips and KYC scans (private, signed reads only)",
    },
    {
      bucket: process.env.IVS_RECORDING_BUCKET,
      purpose: "Live broadcast recordings (IVS auto-record) served as replays",
    },
  ];
  const seen = new Set<string>();
  const out: { bucket: string; purpose: string }[] = [];
  for (const e of entries) {
    const name = (e.bucket ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ bucket: name, purpose: e.purpose });
  }
  return out;
}

/**
 * Bucket sizes from CloudWatch's daily `BucketSizeBytes` / `NumberOfObjects`
 * metrics. They are published once a day, so we ask for the last three days and
 * take the newest datapoint — a fresh bucket simply has none yet, which reads
 * as null rather than zero so the UI can say "no data yet" honestly.
 */
export async function getS3Storage(): Promise<S3Storage> {
  const buckets = configuredBuckets();
  if (buckets.length === 0) {
    return { buckets: [], totalBytes: 0, totalObjects: 0, error: null };
  }

  const region = process.env.AWS_REGION || "ap-southeast-1";
  const start = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  const end = new Date();

  // One GetMetricData call covers every bucket: two queries each, ids indexed
  // so the response maps straight back.
  const queries = buckets.flatMap((b, i) => [
    {
      Id: `size${i}`,
      MetricStat: {
        Metric: {
          Namespace: "AWS/S3",
          MetricName: "BucketSizeBytes",
          Dimensions: [
            { Name: "BucketName", Value: b.bucket },
            { Name: "StorageType", Value: "StandardStorage" },
          ],
        },
        Period: 86_400,
        Stat: "Average",
      },
      ReturnData: true,
    },
    {
      Id: `objs${i}`,
      MetricStat: {
        Metric: {
          Namespace: "AWS/S3",
          MetricName: "NumberOfObjects",
          Dimensions: [
            { Name: "BucketName", Value: b.bucket },
            { Name: "StorageType", Value: "AllStorageTypes" },
          ],
        },
        Period: 86_400,
        Stat: "Average",
      },
      ReturnData: true,
    },
  ]);

  try {
    const client = new CloudWatchClient({ region });
    const res = await client.send(
      new GetMetricDataCommand({
        StartTime: start,
        EndTime: end,
        MetricDataQueries: queries,
        ScanBy: "TimestampDescending",
      }),
    );
    const byId = new Map<string, number | null>();
    for (const r of res.MetricDataResults ?? []) {
      const first = r.Values?.[0];
      byId.set(r.Id ?? "", typeof first === "number" ? first : null);
    }
    const rows: BucketStorage[] = buckets.map((b, i) => ({
      bucket: b.bucket,
      purpose: b.purpose,
      bytes: byId.get(`size${i}`) ?? null,
      objects: byId.get(`objs${i}`) ?? null,
    }));
    return {
      buckets: rows,
      totalBytes: rows.reduce((n, r) => n + (r.bytes ?? 0), 0),
      totalObjects: rows.reduce((n, r) => n + (r.objects ?? 0), 0),
      error: null,
    };
  } catch (e) {
    return {
      buckets: buckets.map((b) => ({
        bucket: b.bucket,
        purpose: b.purpose,
        bytes: null,
        objects: null,
      })),
      totalBytes: 0,
      totalObjects: 0,
      error: (e as Error).message,
    };
  }
}

/** 1.2 GB / 340 MB / 12 kB — bytes a human can read at a glance. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "–";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["kB", "MB", "GB", "TB", "PB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`;
}
