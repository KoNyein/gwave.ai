import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Rocket } from "lucide-react";

import { CodePlayground } from "@/components/learn/code-playground";
import { getCurrentProfile } from "@/lib/auth";
import { getProjectForLesson } from "@/lib/db/learn";

export const metadata = { title: "Code Playground" };
export const dynamic = "force-dynamic";

const STARTER = {
  html: '<h1>Playground 🚀</h1>\n<p>Write any HTML, CSS and JavaScript here.</p>\n<button id="go">Try me</button>\n<p id="out"></p>',
  css: "body { font-family: sans-serif; padding: 2rem; }\nh1 { color: #3B6D11; }\nbutton { padding: 8px 16px; border-radius: 8px; border: 0; background: #639922; color: white; cursor: pointer; }",
  js: "document.getElementById('go').addEventListener('click', () => {\n  document.getElementById('out').textContent = 'It works! ' + new Date().toLocaleTimeString();\n});",
};

/**
 * Free-practice coding page: full-height editor with syntax highlighting and
 * autocompletion, live sandboxed preview, and automatic saving through the
 * same member-project system as lessons (resume any time; shows up under
 * My Projects on the profile).
 */
export default async function PlaygroundPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const saved = await getProjectForLesson(
    profile.id,
    "playground",
    "free-practice",
  );

  return (
    <div className="space-y-4">
      <Link
        href="/learn"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Learn
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Rocket className="h-5 w-5 text-primary" /> Code Playground
        </h1>
        <p className="text-sm text-muted-foreground">
          Practice HTML, CSS and JavaScript with autocompletion and live
          preview. Your code saves automatically.
        </p>
      </div>
      <CodePlayground
        tall
        starter={STARTER}
        title="Playground project"
        lesson={{
          trackSlug: "playground",
          lessonSlug: "free-practice",
          initialData: saved?.data,
        }}
      />
    </div>
  );
}
