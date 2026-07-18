import "server-only";
import { getCurrentUser } from "@/lib/auth";

import { createClient } from "@/lib/supabase/server";
import type { Job, JobApplication } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

const EMPLOYER_EMBED =
  "employer:profiles!jobs_employer_id_fkey(id, username, full_name, avatar_url)";

export interface JobWithEmployer extends Job {
  employer: AuthorSummary | null;
}

export interface JobApplicationWithApplicant extends JobApplication {
  applicant: AuthorSummary | null;
}

export interface MyApplication extends JobApplication {
  job: Pick<Job, "id" | "title" | "category" | "status"> | null;
}

/** Browse open jobs, optionally filtered by category and a text query. */
export async function getJobs(opts: {
  category?: string;
  q?: string;
} = {}): Promise<JobWithEmployer[]> {
  const supabase = await createClient();
  let query = supabase
    .from("jobs")
    .select(`*, ${EMPLOYER_EMBED}`)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100);
  if (opts.category) query = query.eq("category", opts.category);
  if (opts.q) query = query.ilike("title", `%${opts.q}%`);
  const { data, error } = await query.returns<JobWithEmployer[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** A single job with its employer. */
export async function getJob(id: string): Promise<JobWithEmployer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(`*, ${EMPLOYER_EMBED}`)
    .eq("id", id)
    .maybeSingle<JobWithEmployer>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

/** The caller's own postings (any status), newest first. */
export async function getMyJobs(): Promise<Job[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("employer_id", user.id)
    .order("created_at", { ascending: false })
    .returns<Job[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Applications to a job (employer/admin only, enforced by RLS). */
export async function getJobApplications(
  jobId: string,
): Promise<JobApplicationWithApplicant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_applications")
    .select(
      "*, applicant:profiles!job_applications_applicant_id_fkey(id, username, full_name, avatar_url)",
    )
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .returns<JobApplicationWithApplicant[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** The caller's own applications, with the job they applied to. */
export async function getMyApplications(): Promise<MyApplication[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("job_applications")
    .select("*, job:jobs(id, title, category, status)")
    .eq("applicant_id", user.id)
    .order("created_at", { ascending: false })
    .returns<MyApplication[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Whether the caller already applied to a job (returns the application id). */
export async function getMyApplicationForJob(
  jobId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("job_applications")
    .select("id")
    .eq("job_id", jobId)
    .eq("applicant_id", user.id)
    .maybeSingle<{ id: string }>();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}
