import Link from "next/link";
import { PackageOpen, Store, Truck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  {
    href: "/dropshipping/supplier",
    title: "Supplier",
    description: "Register, manage products, inventory, and fulfillment.",
    icon: PackageOpen,
  },
  {
    href: "/dropshipping/catalog",
    title: "Catalog",
    description: "Browse approved supplier products and import listings.",
    icon: Store,
  },
  {
    href: "/dropshipping/orders",
    title: "Orders",
    description: "Track supplier fulfillment and shipment status.",
    icon: Truck,
  },
];

export default function DropshippingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dropshipping</h1>
        <p className="text-sm text-muted-foreground">
          AWS-native supplier, reseller, and fulfillment tools.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {sections.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="h-full transition hover:border-primary">
              <CardHeader>
                <Icon className="h-6 w-6" />
                <CardTitle className="text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {description}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
