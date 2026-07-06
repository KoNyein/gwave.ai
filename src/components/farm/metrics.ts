/** Display config for known farm metrics (others fall back to raw keys). */
export const METRICS: Record<
  string,
  { label: string; unit: string; decimals: number }
> = {
  ph: { label: "pH", unit: "", decimals: 2 },
  ec: { label: "EC", unit: "mS/cm", decimals: 2 },
  vpd: { label: "VPD", unit: "kPa", decimals: 2 },
  air_temp: { label: "Air temp", unit: "°C", decimals: 1 },
  water_temp: { label: "Water temp", unit: "°C", decimals: 1 },
  humidity: { label: "Humidity", unit: "%", decimals: 0 },
};

export function metricLabel(metric: string): string {
  return METRICS[metric]?.label ?? metric.replace(/_/g, " ");
}

export function metricUnit(metric: string): string {
  return METRICS[metric]?.unit ?? "";
}

export function formatMetric(metric: string, value: number): string {
  const decimals = METRICS[metric]?.decimals ?? 2;
  return value.toFixed(decimals);
}
