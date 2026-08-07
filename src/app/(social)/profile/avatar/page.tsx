import { permanentRedirect } from "next/navigation";

/// 🧬 Avatar editor က gWave 3D Studio ရဲ့ tab တစ်ခု ဖြစ်သွားပြီ။
/// Metaverse Avatar Studio, mobile menu, profile page စတဲ့ link အဟောင်း
/// တွေ အကုန် ဒီကနေ ဆက်ရောက်တယ် (login စစ်တာက shell ထဲမှာ)။
export default function AvatarEditorRedirect() {
  permanentRedirect("/studio?tab=avatar");
}
