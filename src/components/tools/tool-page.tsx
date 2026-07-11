import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ToolGuide } from "@/components/tools/tool-guide";
import { Card, CardContent } from "@/components/ui/card";

/** Common wrapper for a calculator page: back link, title, guide, card body. */
export function ToolPage({
  title,
  description,
  backLabel,
  guide,
  children,
}: {
  title: string;
  description: string;
  backLabel: string;
  /** Optional step-by-step how-to shown in a collapsible panel. */
  guide?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href="/tools"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>
      <div className="px-1">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {guide && guide.length > 0 ? <ToolGuide steps={guide} /> : null}
      <Card>
        <CardContent className="p-5">{children}</CardContent>
      </Card>
    </div>
  );
}
