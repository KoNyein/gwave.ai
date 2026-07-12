"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import {
  EMPLOYMENT_TYPE_VALUES,
  JOB_CATEGORY_SLUGS,
  MAX_JOB_QUESTIONS,
} from "@/lib/jobs";
import { createClient } from "@/lib/supabase/server";

async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const jobSchema = z.object({
  title: z.string().trim().min(2).max(160),
  category: z.enum(JOB_CATEGORY_SLUGS as [string, ...string[]]),
  employmentType: z.enum(EMPLOYMENT_TYPE_VALUES as [string, ...string[]]),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  location: z.string().trim().max(160).optional().or(z.literal("")),
  description: z.string().trim().min(1).max(5000),
  requirements: z.string().trim().max(3000).optional().or(z.literal("")),
  salaryMin: z.number().min(0).max(1_000_000_000).nullable().optional(),
  salaryMax: z.number().min(0).max(1_000_000_000).nullable().optional(),
  salaryCurrency: z.string().trim().min(2).max(8).default("MMK"),
  contact: z.string().trim().max(160).optional().or(z.literal("")),
  questions: z
    .array(z.string().trim().min(1).max(200))
    .max(MAX_JOB_QUESTIONS)
    .default([]),
});

export type JobInput = z.infer<typeof jobSchema>;

/** Create or edit one of the caller's job postings. RLS pins employer_id. */
export async function saveJob(
  input: JobInput,
  jobId?: string,
): Promise<ActionResult<{ jobId: string }>> {
  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const v = parsed.data;
  const row = {
    employer_id: userId,
    title: v.title,
    category: v.category,
    employment_type: v.employmentType,
    company: v.company || null,
    location: v.location || null,
    description: v.description,
    requirements: v.requirements || null,
    salary_min: v.salaryMin ?? null,
    salary_max: v.salaryMax ?? null,
    salary_currency: v.salaryCurrency,
    contact: v.contact || null,
    questions: v.questions.filter(Boolean),
  };

  const supabase = await createClient();
  if (jobId) {
    const { error } = await supabase
      .from("jobs")
      .update(row)
      .eq("id", jobId)
      .eq("employer_id", userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/jobs/manage");
    return { ok: true, data: { jobId } };
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert(row)
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not post job." };
  }
  revalidatePath("/jobs");
  revalidatePath("/jobs/manage");
  return { ok: true, data: { jobId: data.id } };
}

/** Employer: open / close one of their postings. */
export async function setJobStatus(
  jobId: string,
  status: "open" | "closed",
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("jobs")
    .update({ status })
    .eq("id", jobId)
    .eq("employer_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/jobs/manage");
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true, data: undefined };
}

/** Employer: delete one of their postings. */
export async function deleteJob(jobId: string): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", jobId)
    .eq("employer_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/jobs/manage");
  return { ok: true, data: undefined };
}

const applicationSchema = z.object({
  jobId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(3).max(40),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  coverLetter: z.string().trim().max(3000).optional().or(z.literal("")),
  expectedSalary: z.number().min(0).max(1_000_000_000).nullable().optional(),
  experienceYears: z.number().int().min(0).max(80).nullable().optional(),
  resumeUrl: z.string().trim().url().max(1000).optional().or(z.literal("")),
  answers: z
    .array(z.object({ q: z.string().max(200), a: z.string().trim().max(1000) }))
    .max(MAX_JOB_QUESTIONS)
    .default([]),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

/** Job-seeker: apply to a job. One application per person per job. */
export async function applyToJob(
  input: ApplicationInput,
): Promise<ActionResult> {
  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("job_applications").insert({
    job_id: v.jobId,
    applicant_id: userId,
    full_name: v.fullName,
    phone: v.phone,
    email: v.email || null,
    cover_letter: v.coverLetter || null,
    expected_salary: v.expectedSalary ?? null,
    experience_years: v.experienceYears ?? null,
    resume_url: v.resumeUrl || null,
    answers: v.answers,
  });
  if (error) {
    const msg = /duplicate|unique/i.test(error.message)
      ? "You have already applied to this job."
      : error.message;
    return { ok: false, error: msg };
  }
  revalidatePath(`/jobs/${v.jobId}`);
  revalidatePath("/jobs/applications");
  return { ok: true, data: undefined };
}

const STATUSES = ["submitted", "shortlisted", "rejected", "hired"] as const;

/** Employer: move an application through the pipeline (RLS enforces employer). */
export async function setApplicationStatus(
  applicationId: string,
  status: (typeof STATUSES)[number],
): Promise<ActionResult> {
  if (!STATUSES.includes(status)) return { ok: false, error: "Invalid status." };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_applications")
    .update({ status })
    .eq("id", applicationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/jobs/manage");
  return { ok: true, data: undefined };
}

/** Job-seeker: withdraw their own application. */
export async function withdrawApplication(
  applicationId: string,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_applications")
    .delete()
    .eq("id", applicationId)
    .eq("applicant_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/jobs/applications");
  return { ok: true, data: undefined };
}
