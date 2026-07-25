import { getMySupplierProfile, getSupplierProducts } from "@/lib/db/dropshipping";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SupplierDashboardPage() {
  const supplier = await getMySupplierProfile();
  const products = supplier ? await getSupplierProducts(supplier.id) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Supplier dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Registration, approval status, products, and inventory.
        </p>
      </div>

      {!supplier ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supplier registration required</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Register through the dropshipping supplier action before adding products.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{supplier.business_name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              Status: <span className="capitalize">{supplier.status}</span>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Card key={product.id}>
                <CardHeader>
                  <CardTitle className="text-base">{product.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>SKU: {product.sku}</p>
                  <p>{product.currency} {Number(product.cost_price).toFixed(2)}</p>
                  <p>{product.stock_quantity} in stock</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
