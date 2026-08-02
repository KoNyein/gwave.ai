import { CITY } from "./city";
import { FARM } from "./farm";
import { SKY } from "./sky";
import { SNOW } from "./snow";
import type { MapDef, MapId } from "./types";

/// Map မှတ်ပုံတင်စာရင်း — **map အသစ်ထည့်ဖို့ ဒီ file တစ်ခုပဲ ထိရမယ်**။
/// Engine (`world.ts`) က `MapDef` ကို ဖတ်ပြီး ဆောက်တာပဲ လုပ်တယ်၊ map
/// တစ်ခုချင်းအကြောင်း ဘာမှ မသိဘူး။

export const MAPS: Record<MapId, MapDef> = {
  city: CITY,
  farm: FARM,
  snow: SNOW,
  sky: SKY,
};

export const MAP_LIST: MapDef[] = [CITY, FARM, SNOW, SKY];

/// ★ မသိတဲ့ id ကို city အဖြစ် ယူတယ် — URL ကနေ ဘာမဆို ဝင်လာနိုင်လို့
/// (server ရဲ့ `normalizeRoom` နဲ့ တူညီတဲ့ ချဉ်းကပ်ပုံ)။
export function getMap(id: string | undefined | null): MapDef {
  const map = id ? MAPS[id as MapId] : undefined;
  return map ?? CITY;
}

export type { MapDef, MapId } from "./types";
