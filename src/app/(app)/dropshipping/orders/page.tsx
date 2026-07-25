import { getMyFulfillmentOrders } from "@/lib/db/dropshipping";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DropshippingOrdersPage() {
  const orders = await getMyFulfillmentOrders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fulfillment orders</h1>
        <p className="text-sm text-muted-foreground">
          Supplier shipment status for dropshipping orders.
        </p>
      </div>

      <div className="space-y-3">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Order {String(order.order_id).slice(0, 8)}</span>
                <span className="capitalize text-muted-foreground">{order.status}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {order.currency} {Number(order.supplier_subtotal).toFixed(2)} · {order.fulfillment_order_items?.length ?? 0} items
            </CardContent>
          </Card>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No fulfillment orders yet.</p>
      ) : null}
    </div>
  );
}
