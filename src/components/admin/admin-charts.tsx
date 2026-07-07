"use client";

import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import type { RevenuePoint } from "@/lib/db/membership";

interface DayPoint {
  day: string;
  count: number;
}

function DayChart({ data, color }: { data: DayPoint[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
        <XAxis
          dataKey="day"
          fontSize={11}
          tickFormatter={(value: string) => value.slice(5)}
          minTickGap={16}
        />
        <YAxis fontSize={11} width={32} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AdminCharts({
  signupsByDay,
  postsByDay,
  revenue,
}: {
  signupsByDay: DayPoint[];
  postsByDay: DayPoint[];
  revenue: RevenuePoint[];
}) {
  const t = useTranslations("admin");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("signupsByDay")}</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <DayChart data={signupsByDay} color="#3B6D11" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("postsByDay")}</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <DayChart data={postsByDay} color="#639922" />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("revenueByMonth")}</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          {revenue.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("noRevenue")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                <XAxis
                  dataKey="month"
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
    </div>
  );
}
