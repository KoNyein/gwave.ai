import { Leaf } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-4 py-12">
      <div className="mb-8 flex items-center gap-2 text-primary">
        <Leaf className="h-8 w-8" />
        <span className="text-2xl font-bold">gwave.ai</span>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
