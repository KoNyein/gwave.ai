import { permanentRedirect } from "next/navigation";

/// 🛰 3D Scanner က gWave 3D Studio ရဲ့ tab တစ်ခု ဖြစ်သွားပြီ (user:
/// "engine + scan + avatar အားလုံး function တစ်ခုတည်း ဖြစ်အောင် ပေါင်း")။
/// Bookmark/app link/QR အဟောင်းတွေ မကျိုးအောင် redirect ချန်ထားတယ်။
export default function ScanRedirect() {
  permanentRedirect("/studio?tab=scan");
}
