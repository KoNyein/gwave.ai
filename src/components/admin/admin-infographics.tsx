"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { Card, CardContent } from "@/components/ui/card";

interface Props {
  totalUsers: number;
  activeMembers: number;
  dau: number;
  wau: number;
  mau: number;
  totalOrders: number;
  orders30d: number;
  deliveredOrders: number;
  lessonsCompleted: number;
  certificatesIssued: number;
  activeLearners30d: number;
}

/** One horizontal "funnel" bar: label, value, and a proportional fill. */
function FunnelBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value.toLocaleString("en-US")}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/**
 * Visual, infographic-style summary of the platform: a members donut plus
 * engagement, commerce and learning funnels — a quicker read than the raw
 * number cards above them.
 */
export function AdminInfographics(props: Props) {
  const members = Math.min(props.activeMembers, props.totalUsers);
  const nonMembers = Math.max(0, props.totalUsers - members);
  const memberPct =
    props.totalUsers > 0 ? Math.round((members / props.totalUsers) * 100) : 0;

  const donut = [
    { name: "အသင်းဝင်", value: members, color: "#3B6D11" },
    { name: "သာမန်", value: nonMembers, color: "#cbd5e1" },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Members composition donut */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-1 font-semibold">👥 အသုံးပြုသူ ဖွဲ့စည်းမှု</p>
          <div className="flex items-center gap-4">
            <div className="relative h-36 w-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donut}
                    dataKey="value"
                    innerRadius={44}
                    outerRadius={64}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {donut.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{memberPct}%</span>
                <span className="text-[10px] text-muted-foreground">
                  အသင်းဝင်
                </span>
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              <p className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#3B6D11]" />
                အသင်းဝင် —{" "}
                <b>{members.toLocaleString("en-US")}</b>
              </p>
              <p className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#cbd5e1]" />
                သာမန် —{" "}
                <b>{nonMembers.toLocaleString("en-US")}</b>
              </p>
              <p className="text-xs text-muted-foreground">
                စုစုပေါင်း {props.totalUsers.toLocaleString("en-US")} ဦး
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Engagement funnel */}
      <Card>
        <CardContent className="space-y-2.5 p-4">
          <p className="font-semibold">📈 တက်ကြွမှု (Engagement)</p>
          <FunnelBar label="MAU · ၃၀ ရက်" value={props.mau} max={props.mau} color="#3B6D11" />
          <FunnelBar label="WAU · ၇ ရက်" value={props.wau} max={props.mau} color="#639922" />
          <FunnelBar label="DAU · ယနေ့" value={props.dau} max={props.mau} color="#8FBF3F" />
        </CardContent>
      </Card>

      {/* Commerce funnel */}
      <Card>
        <CardContent className="space-y-2.5 p-4">
          <p className="font-semibold">🛒 အရောင်း (Commerce)</p>
          <FunnelBar
            label="Order စုစုပေါင်း"
            value={props.totalOrders}
            max={props.totalOrders}
            color="#0D5F8F"
          />
          <FunnelBar
            label="၃၀ ရက်အတွင်း"
            value={props.orders30d}
            max={props.totalOrders}
            color="#16788C"
          />
          <FunnelBar
            label="အရောက်ပို့ပြီး"
            value={props.deliveredOrders}
            max={props.totalOrders}
            color="#34D399"
          />
        </CardContent>
      </Card>

      {/* Learning funnel */}
      <Card>
        <CardContent className="space-y-2.5 p-4">
          <p className="font-semibold">🎓 သင်ယူမှု (Learning)</p>
          <FunnelBar
            label="သင်ခန်းစာ ပြီးမြောက်"
            value={props.lessonsCompleted}
            max={props.lessonsCompleted}
            color="#6D28D9"
          />
          <FunnelBar
            label="သင်ယူသူ ၃၀ရက်"
            value={props.activeLearners30d}
            max={props.lessonsCompleted}
            color="#9D6BDE"
          />
          <FunnelBar
            label="လက်မှတ် ထုတ်ပြီး"
            value={props.certificatesIssued}
            max={props.lessonsCompleted}
            color="#C084FC"
          />
        </CardContent>
      </Card>
    </div>
  );
}
