// ---------------------------------------------------------------------------
// Move existing chat attachments from the public "media" bucket into the private
// "chat-media" bucket, so old photos/files/voice notes stop being readable by
// URL just like new ones.
//
// The object key is unchanged (<userId>/<uuid>.<ext>) and it is exactly what the
// messages rows already store, so NOTHING in the database has to change — the
// read route resolves the same path against the new bucket.
//
// Runs in three explicit, resumable phases. Do not collapse them:
//
//   node scripts/migrate-chat-media.mjs --mode=copy     # media → chat-media (both exist)
//   node scripts/migrate-chat-media.mjs --mode=verify   # assert every path landed
//   node scripts/migrate-chat-media.mjs --mode=purge    # remove from media (irreversible)
//
// After copy, every object exists in BOTH buckets and rollback is free. purge is
// the point of no return: it is the step that actually makes old attachments
// private, and any chat URL ever shared outside the app dies with it. Run verify
// and eyeball its output before purge.
//
// Auth: mints a service_role token the same way the app's admin client does
// (jose + APP_JWT_PRIVATE_KEY/APP_JWT_PUBLIC_JWK), so if the app can reach
// storage, so can this. Load the server env first, e.g.
//   node --env-file=.env.server scripts/migrate-chat-media.mjs --mode=copy
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";
import { SignJWT, importPKCS8 } from "jose";

const SOURCE = "media";
const DEST = "chat-media";
const PAGE = 1000;

const mode = (process.argv.find((a) => a.startsWith("--mode=")) ?? "").split(
  "=",
)[1];
if (!["copy", "verify", "purge"].includes(mode)) {
  console.error("Usage: --mode=copy|verify|purge");
  process.exit(1);
}

/**
 * First of `names` that is set. Lets this script run against either the current
 * NEXT_PUBLIC_DATA_API_* names or the legacy NEXT_PUBLIC_SUPABASE_* ones that
 * are still present in older env files.
 */
function reqEnvAny(...names) {
  for (const name of names) {
    const v = process.env[name];
    if (v) return v;
  }
  console.error(`none of ${names.join(", ")} is set.`);
  process.exit(1);
}

function reqEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} is not set.`);
    process.exit(1);
  }
  return v;
}

async function serviceClient() {
  const pem = Buffer.from(reqEnv("APP_JWT_PRIVATE_KEY"), "base64").toString(
    "utf8",
  );
  const jwk = JSON.parse(reqEnv("APP_JWT_PUBLIC_JWK"));
  const key = await importPKCS8(pem, "ES256");
  const token = await new SignJWT({ role: "service_role" })
    .setProtectedHeader({ alg: "ES256", kid: jwk.kid, typ: "JWT" })
    .setSubject("service_role")
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime("600s")
    .sign(key);

  return createClient(
    reqEnvAny("NEXT_PUBLIC_DATA_API_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    reqEnvAny("NEXT_PUBLIC_DATA_API_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      accessToken: async () => token,
      auth: { persistSession: false },
    },
  );
}

/** Every distinct object path a chat message points at. */
async function chatPaths(db) {
  const paths = new Set();
  for (const column of ["image_path", "file_path"]) {
    let from = 0;
    for (;;) {
      const { data, error } = await db
        .from("messages")
        .select(column)
        .not(column, "is", null)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`read ${column}: ${error.message}`);
      if (!data?.length) break;
      for (const row of data) {
        const p = row[column];
        if (p) paths.add(p);
      }
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  return [...paths];
}

/**
 * Guard against ever deleting a shared object. Every upload mints a fresh UUID,
 * so a chat path should never also back a post/story/reel/product — but if a
 * future "forward to feed" feature ever reused one, purge would delete someone's
 * post. Abort loudly rather than risk it.
 */
async function assertNotShared(db, paths) {
  const set = new Set(paths);
  const checks = [
    ["post_media", "storage_path"],
    ["stories", "media_path"],
    ["reels", "video_path"],
    ["pos_products", "image_path"],
  ];
  const collisions = [];
  for (const [table, column] of checks) {
    let from = 0;
    for (;;) {
      const { data, error } = await db
        .from(table)
        .select(column)
        .not(column, "is", null)
        .range(from, from + PAGE - 1);
      if (error) {
        console.warn(`  (skipping ${table}.${column}: ${error.message})`);
        break;
      }
      if (!data?.length) break;
      for (const row of data) {
        if (set.has(row[column])) collisions.push(`${table}: ${row[column]}`);
      }
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  if (collisions.length) {
    console.error(
      `ABORT: ${collisions.length} chat path(s) are also used by other features. ` +
        `Purging would delete non-chat media:\n  ${collisions.slice(0, 20).join("\n  ")}`,
    );
    process.exit(1);
  }
}

/** Does an object exist in a bucket? (list the parent folder, look for the name.) */
async function exists(db, bucket, path) {
  const slash = path.lastIndexOf("/");
  const folder = path.slice(0, slash);
  const name = path.slice(slash + 1);
  const { data, error } = await db.storage
    .from(bucket)
    .list(folder, { search: name, limit: 100 });
  if (error) return false;
  return (data ?? []).some((o) => o.name === name);
}

async function run() {
  const db = await serviceClient();
  const paths = await chatPaths(db);
  console.log(`${paths.length} distinct chat attachment(s) referenced.`);

  if (mode === "copy") {
    let copied = 0;
    let skipped = 0;
    let failed = 0;
    for (const path of paths) {
      // Idempotent: skip anything already in the destination.
      if (await exists(db, DEST, path)) {
        skipped++;
        continue;
      }
      const { error } = await db.storage
        .from(SOURCE)
        .copy(path, path, { destinationBucket: DEST });
      if (error) {
        // A missing source (already purged, or never uploaded) is not fatal.
        if (await exists(db, DEST, path)) {
          skipped++;
        } else {
          failed++;
          console.warn(`  copy failed: ${path} — ${error.message}`);
        }
      } else {
        copied++;
      }
    }
    console.log(`copy done: ${copied} copied, ${skipped} already there, ${failed} failed.`);
    console.log("Objects now live in BOTH buckets. Run --mode=verify next.");
    if (failed) process.exit(1);
    return;
  }

  if (mode === "verify") {
    let ok = 0;
    const missing = [];
    for (const path of paths) {
      if (await exists(db, DEST, path)) ok++;
      else missing.push(path);
    }
    console.log(`verify: ${ok}/${paths.length} present in "${DEST}".`);
    if (missing.length) {
      console.error(
        `${missing.length} missing — re-run --mode=copy:\n  ${missing.slice(0, 20).join("\n  ")}`,
      );
      process.exit(1);
    }
    console.log("All chat attachments are in the private bucket. Safe to --mode=purge.");
    return;
  }

  if (mode === "purge") {
    // Never derive the delete list from a bucket listing — the source bucket is
    // shared with posts/avatars/reels. Only ever remove the exact paths the
    // database says are chat attachments.
    await assertNotShared(db, paths);

    // Refuse to purge anything that isn't safely in the destination yet.
    const notCopied = [];
    for (const path of paths) {
      if (!(await exists(db, DEST, path))) notCopied.push(path);
    }
    if (notCopied.length) {
      console.error(
        `ABORT: ${notCopied.length} path(s) are not in "${DEST}" yet. Run copy+verify first.`,
      );
      process.exit(1);
    }

    let removed = 0;
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const { error } = await db.storage.from(SOURCE).remove(batch);
      if (error) {
        console.error(`  remove batch failed: ${error.message}`);
        process.exit(1);
      }
      removed += batch.length;
    }
    console.log(`purge done: removed ${removed} object(s) from "${SOURCE}".`);
    console.log("Chat attachments are now private. Set CHAT_MEDIA_FALLBACK_PUBLIC=0.");
    return;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
