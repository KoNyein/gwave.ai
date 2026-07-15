import Link from "next/link";
import { Leaf } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/10 via-muted to-background px-4 py-12">
      <Link href="/welcome" className="mb-6 flex items-center gap-2 text-primary">
        <Leaf className="h-9 w-9" />
        <span className="text-2xl font-bold">Gwave</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-6 text-sm text-muted-foreground">
        အခက်ခဲ ရှိပါသလား?{" "}
        <Link href="/help" className="font-medium text-primary hover:underline">
          အကူအညီနှင့် လမ်းညွှန် ကြည့်ရန်
        </Link>
      </p>
    </div>
  );
}
