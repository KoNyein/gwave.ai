import { getApprovedSupplierCatalog } from "@/lib/db/dropshipping";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DropshippingCatalogPage() {
  const products = await getApprovedSupplierCatalog();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Supplier catalog</h1>
        <p className="text-sm text-muted-foreground">
          Approved products available for reseller import.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id}>
            <CardHeader>
              <CardTitle className="text-base">{product.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{product.description || "No description"}</p>
              <div className="flex justify-between">
                <span>{product.currency} {Number(product.cost_price).toFixed(2)}</span>
                <span>{product.stock_quantity} in stock</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No approved supplier products yet.</p>
      ) : null}
    </div>
  );
}
