import "server-only";

import { createClient } from "@/lib/data/server";
import type {
  Alert,
  AutomationRule,
  Device,
  Scene,
  SceneSchedule,
} from "@/types/database";

export interface LatestReading {
  device_id: string;
  metric: string;
  value: number;
  ts: string;
}

export async function getDevices(userId: string): Promise<Device[]> {
  const db = await createClient();
  const { data } = await db
    .from("devices")
    .select("*")
    .eq("owner_id", userId)
    .order("zone")
    .order("name");
  return data ?? [];
}

export async function getLatestReadings(): Promise<LatestReading[]> {
  const db = await createClient();
  const { data, error } = await db.rpc("latest_sensor_readings");
  if (error) throw new Error(`Failed to load readings: ${error.message}`);
  return ((data ?? []) as LatestReading[]).map((row) => ({
    ...row,
    value: Number(row.value),
  }));
}

/** Recent readings for sparklines (last `limit` per call, one metric). */
export async function getRecentReadings(
  deviceId: string,
  metric: string,
  limit = 30,
): Promise<{ value: number; ts: string }[]> {
  const db = await createClient();
  const { data } = await db
    .from("sensor_readings")
    .select("value, ts")
    .eq("device_id", deviceId)
    .eq("metric", metric)
    .order("ts", { ascending: false })
    .limit(limit);
  return (data ?? [])
    .reverse()
    .map((row) => ({ value: Number(row.value), ts: row.ts }));
}

export interface RuleWithDevices extends AutomationRule {
  trigger_device: Pick<Device, "id" | "name"> | null;
  action_device: Pick<Device, "id" | "name"> | null;
}

export async function getRules(userId: string): Promise<RuleWithDevices[]> {
  const db = await createClient();
  const { data } = await db
    .from("automation_rules")
    .select(
      `*,
       trigger_device:devices!automation_rules_trigger_device_id_fkey(id, name),
       action_device:devices!automation_rules_action_device_id_fkey(id, name)`,
    )
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .returns<RuleWithDevices[]>();
  return data ?? [];
}

export interface AlertWithDevice extends Alert {
  device: Pick<Device, "id" | "name"> | null;
}

export async function getAlerts(
  userId: string,
  limit = 50,
): Promise<AlertWithDevice[]> {
  const db = await createClient();
  const { data } = await db
    .from("alerts")
    .select("*, device:devices!alerts_device_id_fkey(id, name)")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AlertWithDevice[]>();
  return data ?? [];
}

export interface SceneWithSchedules extends Scene {
  schedules: SceneSchedule[];
}

export async function getScenes(userId: string): Promise<SceneWithSchedules[]> {
  const db = await createClient();
  const { data } = await db
    .from("scenes")
    .select("*, schedules:scene_schedules(*)")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .returns<SceneWithSchedules[]>();
  return data ?? [];
}
