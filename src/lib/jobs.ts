// Shared, client-safe constants for the Jobs / Vacancy board.

/** Job categories (slug + Burmese-first label + emoji). */
export const JOB_CATEGORIES = [
  { slug: "agriculture", label: "စိုက်ပျိုးရေး / မွေးမြူရေး", emoji: "🌱" },
  { slug: "sales", label: "အရောင်း / စျေးကွက်", emoji: "🛒" },
  { slug: "it", label: "IT / Software", emoji: "💻" },
  { slug: "admin", label: "ရုံးလုပ်ငန်း / Admin", emoji: "🗂️" },
  { slug: "finance", label: "ငွေစာရင်း / ဘဏ္ဍာ", emoji: "💰" },
  { slug: "engineering", label: "အင်ဂျင်နီယာ", emoji: "🛠️" },
  { slug: "driver", label: "ယာဉ်မောင်း / ပို့ဆောင်ရေး", emoji: "🚚" },
  { slug: "construction", label: "ဆောက်လုပ်ရေး", emoji: "🏗️" },
  { slug: "hospitality", label: "ဟိုတယ် / စားသောက်ဆိုင်", emoji: "🍽️" },
  { slug: "healthcare", label: "ကျန်းမာရေး", emoji: "🩺" },
  { slug: "education", label: "ပညာရေး / သင်ကြားရေး", emoji: "📚" },
  { slug: "design", label: "ဒီဇိုင်း / Creative", emoji: "🎨" },
  { slug: "other", label: "အခြား", emoji: "📌" },
] as const;

export type JobCategorySlug = (typeof JOB_CATEGORIES)[number]["slug"];

export const JOB_CATEGORY_SLUGS = JOB_CATEGORIES.map((c) => c.slug);

export function jobCategory(slug: string) {
  return JOB_CATEGORIES.find((c) => c.slug === slug);
}

/** Employment types (value + Burmese-first label). */
export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "အချိန်ပြည့်" },
  { value: "part_time", label: "အချိန်ပိုင်း" },
  { value: "contract", label: "ကန်ထရိုက်" },
  { value: "internship", label: "အလုပ်သင်" },
  { value: "temporary", label: "ယာယီ" },
  { value: "remote", label: "အဝေးမှ (Remote)" },
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]["value"];

export const EMPLOYMENT_TYPE_VALUES = EMPLOYMENT_TYPES.map((t) => t.value);

export function employmentTypeLabel(value: string): string {
  return EMPLOYMENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

export const APPLICATION_STATUSES = [
  { value: "submitted", label: "တင်ပြီး", style: "bg-amber-500/10 text-amber-600" },
  { value: "shortlisted", label: "ရွေးချယ်ခံ", style: "bg-primary/10 text-primary" },
  { value: "hired", label: "ခန့်အပ်", style: "bg-green-500/10 text-green-600" },
  { value: "rejected", label: "ငြင်းပယ်", style: "bg-destructive/10 text-destructive" },
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]["value"];

export function applicationStatusMeta(value: string) {
  return (
    APPLICATION_STATUSES.find((s) => s.value === value) ?? APPLICATION_STATUSES[0]
  );
}

/** Max custom questions an employer can attach to a job. */
export const MAX_JOB_QUESTIONS = 8;
