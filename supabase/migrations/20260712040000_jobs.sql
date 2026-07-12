-- Jobs / Vacancies — employers post openings under a category; job-seekers
-- browse by category and apply with their details plus answers to the
-- employer's custom questions.
--
-- Money never involved here; it's a listing + application board. Employers
-- manage their own postings and see who applied; applicants see their own
-- applications. RLS keeps each side to what it should see.

-- ---------------------------------------------------------------------------
-- Job postings
-- ---------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  -- Category slug (validated against a fixed list in the app).
  category text not null check (char_length(category) between 2 and 40),
  employment_type text not null default 'full_time'
    check (employment_type in
      ('full_time', 'part_time', 'contract', 'internship', 'temporary', 'remote')),
  company text check (company is null or char_length(company) <= 120),
  location text check (location is null or char_length(location) <= 160),
  description text not null check (char_length(description) between 1 and 5000),
  requirements text check (requirements is null or char_length(requirements) <= 3000),
  salary_min numeric(14, 2) check (salary_min is null or salary_min >= 0),
  salary_max numeric(14, 2) check (salary_max is null or salary_max >= 0),
  salary_currency text not null default 'MMK'
    check (char_length(salary_currency) between 2 and 8),
  contact text check (contact is null or char_length(contact) <= 160),
  -- Employer's custom application questions: a JSON array of question strings.
  questions jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_category_idx on public.jobs (category, created_at desc);
create index jobs_employer_idx on public.jobs (employer_id, created_at desc);
create index jobs_status_idx on public.jobs (status, created_at desc);

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.handle_updated_at();

alter table public.jobs enable row level security;

-- Anyone signed in browses open jobs; employers also see their own (any
-- status); admins see everything.
create policy "Read open jobs, own jobs, admin all"
  on public.jobs
  for select
  to authenticated
  using (status = 'open' or employer_id = auth.uid() or public.is_admin());

-- Post a job as yourself (not while suspended).
create policy "Employer posts own job"
  on public.jobs
  for insert
  to authenticated
  with check (employer_id = auth.uid() and not public.is_suspended(auth.uid()));

create policy "Employer or admin edits job"
  on public.jobs
  for update
  to authenticated
  using (employer_id = auth.uid() or public.is_admin())
  with check (employer_id = auth.uid() or public.is_admin());

create policy "Employer or admin deletes job"
  on public.jobs
  for delete
  to authenticated
  using (employer_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------
create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (char_length(phone) between 3 and 40),
  email text check (email is null or char_length(email) <= 160),
  cover_letter text check (cover_letter is null or char_length(cover_letter) <= 3000),
  expected_salary numeric(14, 2) check (expected_salary is null or expected_salary >= 0),
  experience_years int check (experience_years is null or experience_years between 0 and 80),
  resume_url text check (resume_url is null or char_length(resume_url) <= 1000),
  -- Answers to the job's custom questions: JSON array of {q, a}.
  answers jsonb not null default '[]'::jsonb,
  status text not null default 'submitted'
    check (status in ('submitted', 'shortlisted', 'rejected', 'hired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One application per person per job.
  unique (job_id, applicant_id)
);

create index job_applications_job_idx on public.job_applications (job_id, created_at desc);
create index job_applications_applicant_idx
  on public.job_applications (applicant_id, created_at desc);

create trigger job_applications_set_updated_at
  before update on public.job_applications
  for each row execute function public.handle_updated_at();

alter table public.job_applications enable row level security;

-- Applicant sees their own; the job's employer sees applications to their
-- jobs; admins see all.
create policy "Applicant, employer, admin read applications"
  on public.job_applications
  for select
  to authenticated
  using (
    applicant_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.jobs j
      where j.id = public.job_applications.job_id and j.employer_id = auth.uid()
    )
  );

-- Apply as yourself, only to an open job, and not while suspended.
create policy "Applicant submits application"
  on public.job_applications
  for insert
  to authenticated
  with check (
    applicant_id = auth.uid()
    and not public.is_suspended(auth.uid())
    and exists (
      select 1 from public.jobs j
      where j.id = public.job_applications.job_id and j.status = 'open'
    )
  );

-- The employer of the job (or an admin) moves an application through the
-- pipeline; the applicant cannot change their own status.
create policy "Employer or admin updates application"
  on public.job_applications
  for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.jobs j
      where j.id = public.job_applications.job_id and j.employer_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.jobs j
      where j.id = public.job_applications.job_id and j.employer_id = auth.uid()
    )
  );

-- Applicant may withdraw (delete) their own application.
create policy "Applicant withdraws own application"
  on public.job_applications
  for delete
  to authenticated
  using (applicant_id = auth.uid());
