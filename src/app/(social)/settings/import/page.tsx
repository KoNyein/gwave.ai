import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { FacebookImport } from "@/components/settings/facebook-import";
import { getCurrentProfile } from "@/lib/auth";
import { prefersMyanmarScript } from "@/i18n/config";

export const metadata = { title: "Import from Facebook" };

/**
 * Restore a Facebook "Download Your Information" archive into Gwave. The
 * archive is parsed entirely in the browser; posts/photos only reach the
 * server through the normal create-post pipeline when the user imports.
 */
export default async function ImportPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const mm = prefersMyanmarScript(await getLocale());

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">
          {mm ? "📥 Facebook data ပြန်သွင်းရန်" : "📥 Import from Facebook"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mm
            ? "Facebook account ပိတ်ခံရရင်တောင် Download Your Information ZIP ကနေ ကိုယ့် post တွေ၊ ဓာတ်ပုံတွေကို Gwave ထဲ ပြန်ယူလို့ရပါတယ်။"
            : "Even if your Facebook account was disabled, your posts and photos can be restored into Gwave from the Download Your Information ZIP."}
        </p>
      </div>
      <FacebookImport userId={profile.id} />
      <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">
          {mm ? "ZIP ရယူနည်း" : "How to get the ZIP"}
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            {mm
              ? "Facebook ရဲ့ \"Download Your Information\" စာမျက်နှာကို ဖွင့်ပါ (account ပိတ်ခံရတဲ့ မျက်နှာပြင်မှာလည်း ဒီခလုတ် ပါပါတယ်)။"
              : 'Open Facebook\'s "Download Your Information" page (the disabled-account screen also has this button).'}
          </li>
          <li>
            {mm
              ? "Format ကို JSON ရွေးပြီး ဒေါင်းပါ — HTML မရွေးပါနဲ့။"
              : "Choose JSON as the format — not HTML."}
          </li>
          <li>
            {mm
              ? "ရလာတဲ့ ZIP ကို အပေါ်မှာ ရွေးပေးရုံပါပဲ။"
              : "Pick the resulting ZIP above."}
          </li>
        </ol>
      </div>
    </div>
  );
}
