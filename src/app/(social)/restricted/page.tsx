import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Restricted content" };

export default function RestrictedPage() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-7 w-7" />
        </span>
        <div>
          <h1 className="text-xl font-bold">This area is for adults</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Some parts of gwave.ai cover regulated topics and are only available
            to members aged 18 and over. There&apos;s still plenty for you to
            explore — including learning content made for your age group.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/learn"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Explore learning
          </Link>
          <Link
            href="/feed"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to feed
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
