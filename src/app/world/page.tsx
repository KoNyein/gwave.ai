import { permanentRedirect } from "next/navigation";

/// 🌍 Open World က **gwave.cc/metaverse ကိုယ်တိုင်** ဖြစ်သွားပြီ — လောက
/// နှစ်ခု မရှိတော့ဘူး (user: "metaverse နဲ့ open world ကို ခုထဲ ဖြစ်အောင်")။
/// /world ကို bookmark ထားသူ၊ APK menu link၊ QR အဟောင်းတွေ မကျိုးအောင်
/// redirect ချန်ထားတယ်။
export default function WorldRedirect() {
  permanentRedirect("/metaverse");
}
