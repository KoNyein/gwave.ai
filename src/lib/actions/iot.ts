"use server";

import { randomBytes } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/data/server";
import type { ActionResult } from "@/lib/actions/posts";

const uuid = z.string().uuid();

async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

const registerDeviceSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["sensor", "switch", "camera", "controller"]),
  zone: z.string().min(1).max(40),
});

export interface DeviceCredentials {
  deviceId: string;
  topic: string;
  secret: string;
}

/**
 * Registers a device and returns its MQTT credentials — the secret is shown
 * exactly once in the UI (it stays queryable only by the owner via RLS).
 */
export async function registerDevice(
  input: z.infer<typeof registerDeviceSchema>,
): Promise<ActionResult<DeviceCredentials>> {
  const parsed = registerDeviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid device." };

  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const db = await createClient();
  const secret = randomBytes(24).toString("base64url");

  const { data: device, error } = await db
    .from("devices")
    .insert({
      owner_id: userId,
      name: parsed.data.name.trim(),
      type: parsed.data.type,
      zone: parsed.data.zone.trim(),
      topic: "placeholder", // replaced below once the id is known
      secret,
    })
    .select("id")
    .single();
  if (error || !device) {
    return { ok: false, error: error?.message ?? "Failed to register." };
  }

  const topic = `gwave/${device.id}`;
  const { error: topicError } = await db
    .from("devices")
    .update({ topic })
    .eq("id", device.id);
  if (topicError) return { ok: false, error: topicError.message };

  revalidatePath("/farm/devices");
  return { ok: true, data: { deviceId: device.id, topic, secret } };
}

export async function updateDevice(
  deviceId: string,
  updates: { name?: string; zone?: string },
): Promise<ActionResult> {
  if (!uuid.safeParse(deviceId).success) {
    return { ok: false, error: "Invalid device." };
  }
  const parsed = z
    .object({
      name: z.string().min(1).max(80).optional(),
      zone: z.string().min(1).max(40).optional(),
    })
    .safeParse(updates);
  if (!parsed.success) return { ok: false, error: "Invalid update." };

  const db = await createClient();
  const { error } = await db
    .from("devices")
    .update(parsed.data)
    .eq("id", deviceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/farm", "layout");
  return { ok: true, data: undefined };
}

export async function deleteDevice(deviceId: string): Promise<ActionResult> {
  if (!uuid.safeParse(deviceId).success) {
    return { ok: false, error: "Invalid device." };
  }
  const db = await createClient();
  const { error } = await db.from("devices").delete().eq("id", deviceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/farm", "layout");
  return { ok: true, data: undefined };
}

/** Queues an MQTT command; the bridge publishes it to <topic>/cmd. */
export async function sendDeviceCommand(
  deviceId: string,
  command: Record<string, string | number | boolean>,
): Promise<ActionResult> {
  if (!uuid.safeParse(deviceId).success) {
    return { ok: false, error: "Invalid device." };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const db = await createClient();
  const { error } = await db.from("device_commands").insert({
    device_id: deviceId,
    issued_by: userId,
    command,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Automation rules
// ---------------------------------------------------------------------------

const ruleSchema = z.object({
  name: z.string().min(1).max(80),
  triggerDeviceId: z.string().uuid(),
  metric: z.string().min(1).max(40),
  comparator: z.enum(["gt", "gte", "lt", "lte"]),
  threshold: z.number().finite(),
  actionDeviceId: z.string().uuid().nullable(),
  actionCommand: z.enum(["on", "off"]).nullable(),
  timeStart: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  timeEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  severity: z.enum(["info", "warning", "critical"]),
});

export async function createRule(
  input: z.infer<typeof ruleSchema>,
): Promise<ActionResult> {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Invalid rule.",
    };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const db = await createClient();
  const { error } = await db.from("automation_rules").insert({
    owner_id: userId,
    name: parsed.data.name.trim(),
    trigger_device_id: parsed.data.triggerDeviceId,
    metric: parsed.data.metric,
    comparator: parsed.data.comparator,
    threshold: parsed.data.threshold,
    action_device_id: parsed.data.actionDeviceId,
    action: parsed.data.actionCommand
      ? { power: parsed.data.actionCommand }
      : {},
    time_start: parsed.data.timeStart,
    time_end: parsed.data.timeEnd,
    severity: parsed.data.severity,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/farm/rules");
  return { ok: true, data: undefined };
}

export async function setRuleEnabled(
  ruleId: string,
  enabled: boolean,
): Promise<ActionResult> {
  if (!uuid.safeParse(ruleId).success) {
    return { ok: false, error: "Invalid rule." };
  }
  const db = await createClient();
  const { error } = await db
    .from("automation_rules")
    .update({ enabled })
    .eq("id", ruleId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/farm/rules");
  return { ok: true, data: undefined };
}

export async function deleteRule(ruleId: string): Promise<ActionResult> {
  if (!uuid.safeParse(ruleId).success) {
    return { ok: false, error: "Invalid rule." };
  }
  const db = await createClient();
  const { error } = await db
    .from("automation_rules")
    .delete()
    .eq("id", ruleId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/farm/rules");
  return { ok: true, data: undefined };
}

export async function acknowledgeAlert(alertId: string): Promise<ActionResult> {
  if (!uuid.safeParse(alertId).success) {
    return { ok: false, error: "Invalid alert." };
  }
  const db = await createClient();
  const { error } = await db
    .from("alerts")
    .update({ acknowledged: true })
    .eq("id", alertId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/farm/rules");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Scenes & schedules
// ---------------------------------------------------------------------------

const sceneSchema = z.object({
  name: z.string().min(1).max(80),
  actions: z
    .array(
      z.object({
        deviceId: z.string().uuid(),
        power: z.enum(["on", "off"]),
      }),
    )
    .min(1)
    .max(20),
});

export async function createScene(
  input: z.infer<typeof sceneSchema>,
): Promise<ActionResult> {
  const parsed = sceneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid scene." };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const db = await createClient();
  const { error } = await db.from("scenes").insert({
    owner_id: userId,
    name: parsed.data.name.trim(),
    actions: parsed.data.actions.map((action) => ({
      device_id: action.deviceId,
      command: { power: action.power },
    })),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/home");
  return { ok: true, data: undefined };
}

export async function deleteScene(sceneId: string): Promise<ActionResult> {
  if (!uuid.safeParse(sceneId).success) {
    return { ok: false, error: "Invalid scene." };
  }
  const db = await createClient();
  const { error } = await db.from("scenes").delete().eq("id", sceneId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/home");
  return { ok: true, data: undefined };
}

/** Runs a scene now by queueing a command per action. */
export async function runScene(sceneId: string): Promise<ActionResult> {
  if (!uuid.safeParse(sceneId).success) {
    return { ok: false, error: "Invalid scene." };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const db = await createClient();
  const { data: scene } = await db
    .from("scenes")
    .select("actions")
    .eq("id", sceneId)
    .maybeSingle();
  if (!scene) return { ok: false, error: "Scene not found." };

  const actions = scene.actions as {
    device_id: string;
    command: Record<string, unknown>;
  }[];
  if (actions.length === 0) return { ok: true, data: undefined };

  const { error } = await db.from("device_commands").insert(
    actions.map((action) => ({
      device_id: action.device_id,
      issued_by: userId,
      command: action.command,
    })),
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

const scheduleSchema = z.object({
  sceneId: z.string().uuid(),
  runAt: z.string().regex(/^\d{2}:\d{2}$/),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1).max(7),
});

export async function createSchedule(
  input: z.infer<typeof scheduleSchema>,
): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid schedule." };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const db = await createClient();
  const { error } = await db.from("scene_schedules").insert({
    owner_id: userId,
    scene_id: parsed.data.sceneId,
    run_at: parsed.data.runAt,
    days_of_week: parsed.data.daysOfWeek,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/home");
  return { ok: true, data: undefined };
}

export async function deleteSchedule(
  scheduleId: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(scheduleId).success) {
    return { ok: false, error: "Invalid schedule." };
  }
  const db = await createClient();
  const { error } = await db
    .from("scene_schedules")
    .delete()
    .eq("id", scheduleId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/home");
  return { ok: true, data: undefined };
}
