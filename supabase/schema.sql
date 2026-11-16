create extension if not exists pgcrypto;

create table if not exists public.task_materials (
  id uuid primary key default gen_random_uuid(),
  task_id text not null,
  teacher_id text not null,
  file_name text not null,
  storage_path text,
  mime_type text,
  size_bytes bigint not null default 0,
  link_url text,
  created_at timestamptz not null default now(),
  constraint task_materials_file_or_link check (storage_path is not null or link_url is not null)
);

create index if not exists task_materials_task_idx on public.task_materials(task_id, created_at);

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id text not null,
  student_id text not null,
  file_name text not null,
  storage_path text,
  mime_type text,
  size_bytes bigint not null default 0,
  link_url text,
  comment text not null default '',
  created_at timestamptz not null default now(),
  constraint assignment_submissions_file_or_link check (storage_path is not null or link_url is not null)
);

create index if not exists assignment_submissions_assignment_idx on public.assignment_submissions(assignment_id, created_at desc);

create table if not exists public.assignment_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions(id) on delete cascade,
  teacher_id text not null,
  status text not null check (status in ('approved', 'revision_requested')),
  feedback text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists assignment_reviews_submission_idx on public.assignment_reviews(submission_id, created_at desc);

alter table public.task_materials enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.assignment_reviews enable row level security;

-- The app accesses these tables only from its server using the Supabase secret/service-role key.
-- Do not add public client policies or expose the server key in frontend code.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-files',
  'task-files',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
