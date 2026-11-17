-- Daily Duty core schema for Supabase Postgres.
-- This migration is additive and intentionally does not modify the existing
-- task_materials, assignment_submissions, or assignment_reviews tables.

create table if not exists public.users (
  id text primary key,
  email text not null,
  password_hash text not null,
  name text not null,
  role text not null check (role in ('teacher', 'student')),
  created_at timestamptz not null
);
create unique index if not exists users_email_lower_uidx on public.users (lower(email));

create table if not exists public.classes (
  id text primary key,
  teacher_id text not null references public.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null,
  unique (teacher_id, name)
);

create table if not exists public.class_members (
  class_id text not null references public.classes(id) on delete cascade,
  student_id text not null unique references public.users(id) on delete cascade,
  created_at timestamptz not null,
  primary key (class_id, student_id)
);

create table if not exists public.tasks (
  id text primary key,
  series_id text not null,
  teacher_id text not null references public.users(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  title text not null,
  description text not null default '',
  instructions text not null default '',
  priority text not null check (priority in ('low','medium','high')),
  penalty text not null default '',
  assignment_date date not null,
  deadline_date date not null,
  deadline_time text not null,
  recurrence text not null check (recurrence in ('once','daily','weekly','custom')),
  color text not null check (color in ('yellow','pink','blue','green','orange','purple')),
  status text not null default 'active' check (status in ('active','cancelled')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (series_id, assignment_date)
);

create table if not exists public.task_assignments (
  id text primary key,
  task_id text not null references public.tasks(id) on delete cascade,
  student_id text not null references public.users(id) on delete cascade,
  in_progress boolean not null default false,
  created_at timestamptz not null,
  unique (task_id, student_id)
);

create table if not exists public.task_completions (
  id text primary key,
  assignment_id text not null unique references public.task_assignments(id) on delete cascade,
  completed_at timestamptz not null
);

create table if not exists public.notifications (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  entity_id text not null,
  read_at timestamptz,
  created_at timestamptz not null,
  unique (user_id, type, entity_id)
);

create index if not exists idx_tasks_teacher on public.tasks(teacher_id);
create index if not exists idx_tasks_class on public.tasks(class_id);
create index if not exists idx_assign_student on public.task_assignments(student_id);
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);

alter table public.users enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.task_completions enable row level security;
alter table public.notifications enable row level security;
