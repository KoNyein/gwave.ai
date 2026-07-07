"use client";

import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ReportData } from "@/lib/db/pos";

const PIE_COLORS = ["#3B6D11", "#639922", "#A3C585"];

export function ReportsView({
  report,
  currency,
  from,
  to,
}: {
  report: ReportData;
  currency: string;
  from: string;
  to: string;
}) {
  const t = useTranslations("pos");
  const average =
    report.transactionCount > 0
      ? report.totalSales / report.transactionCount
      : 0;

  return (
    <div className="space-y-4">
      {/* Date range (GET form -> server re-render) */}
      <form action="/pos/reports" className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="from" className="block text-xs text-muted-foreground">
            {t("from")}
          </label>
          <input
            id="from"
            type="date"
            name="from"
            defaultValue={from}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="to" className="block text-xs text-muted-foreground">
            {t("to")}
          </label>
          <input
            id="to"
            type="date"
            name="to"
            defaultValue={to}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {t("apply")}
        </button>
      </form>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: t("totalSales"),
            value: `${report.totalSales.toLocaleString()} ${currency}`,
          },
          { label: t("transactions"), value: report.transactionCount },
          {
            label: t("averageSale"),
            value: `${average.toFixed(2)} ${currency}`,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sales by day */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("salesByDay")}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {report.byDay.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.byDay}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                  <XAxis
                    dataKey="day"
                    fontSize={11}
                    tickFormatter={(value: string) => value.slice(5)}
                  />
                  <YAxis fontSize={11} width={44} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#3B6D11" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Payment methods */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("paymentBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {report.byMethod.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={report.byMethod}
                    dataKey="total"
                    nameKey="method"
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                  >
                    {report.byMethod.map((entry, index) => (
                      <Cell
                        key={entry.method}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("topItems")}</CardTitle>
          </CardHeader>
          <CardContent>
            {report.topItems.length === 0 ? (
              <Empty />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-2">{t("item")}</th>
                    <th className="pb-2 text-right">{t("qty")}</th>
                    <th className="pb-2 text-right">{t("total")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.topItems.map((item) => (
                    <tr key={item.name}>
                      <td className="py-1.5">{item.name}</td>
                      <td className="py-1.5 text-right">{item.quantity}</td>
                      <td className="py-1.5 text-right font-medium">
                        {item.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("categoryBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.byCategory.length === 0 ? (
              <Empty />
            ) : (
              report.byCategory.map((entry) => {
                const max = report.byCategory[0]?.total ?? 1;
                return (
                  <div key={entry.category}>
                    <div className="mb-0.5 flex justify-between text-sm">
                      <span>{entry.category}</span>
                      <span className="font-medium">
                        {entry.total.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${(entry.total / max) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Empty() {
  const t = useTranslations("pos");
  return (
    <div className="flex h-full min-h-24 items-center justify-center text-sm text-muted-foreground">
      {t("noReportData")}
    </div>
  );
}
