begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  email text not null,
  role text not null check (role in ('supervisor','trainee')),
  "supervisorId" uuid references public.profiles(id),
  "trainingField" text not null default '',
  bio text not null default '',
  available boolean not null default false,
  "createdAt" timestamptz not null default now(),
  check ((role = 'supervisor' and "supervisorId" is null) or (role = 'trainee' and "supervisorId" is not null))
);
create unique index profiles_email_unique on public.profiles(lower(email));
create index profiles_supervisor on public.profiles("supervisorId");
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  "traineeId" uuid not null references public.profiles(id) on delete cascade,
  "supervisorId" uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text not null check (length(trim(description)) > 0),
  "dueDate" date not null,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'pending' check (status in ('pending','progress','completed')),
  "supervisorNotes" text not null default '',
  "traineeNotes" text not null default '',
  "createdAt" timestamptz not null default now(),
  "completedAt" timestamptz
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  "traineeId" uuid not null references public.profiles(id) on delete cascade,
  "supervisorId" uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  work text not null check (length(trim(work)) > 0),
  learned text not null default '',
  challenges text not null default '',
  plan text not null default '',
  "updatedAt" timestamptz not null default now(),
  unique ("traineeId",date)
);
create index tasks_supervisor on public.tasks("supervisorId");
create index tasks_trainee on public.tasks("traineeId");
create index reports_supervisor on public.reports("supervisorId");
create index reports_trainee on public.reports("traineeId");

create function public.owns_trainee(trainee uuid, supervisor uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles t join public.profiles s on s.id=t."supervisorId"
    where t.id=trainee and t.role='trainee' and s.id=supervisor and s.role='supervisor');
$$;
revoke all on function public.owns_trainee(uuid,uuid) from public;
grant execute on function public.owns_trainee(uuid,uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.reports enable row level security;
revoke all on public.profiles, public.tasks, public.reports from anon, authenticated;
grant all on public.profiles, public.tasks, public.reports to service_role;
grant select on public.profiles, public.tasks, public.reports to authenticated;
grant update (name,bio,"trainingField",available) on public.profiles to authenticated;
grant insert on public.tasks, public.reports to authenticated;
grant update (status,"traineeNotes","completedAt") on public.tasks to authenticated;
grant update (work,learned,challenges,plan,"updatedAt") on public.reports to authenticated;

create policy profiles_read on public.profiles for select to authenticated
using (id=auth.uid() or public.owns_trainee(id,auth.uid()) or public.owns_trainee(auth.uid(),id));
create policy profiles_update on public.profiles for update to authenticated
using (id=auth.uid()) with check (id=auth.uid());
create policy tasks_read on public.tasks for select to authenticated
using (("traineeId"=auth.uid() or "supervisorId"=auth.uid()) and public.owns_trainee("traineeId","supervisorId"));
create policy tasks_insert on public.tasks for insert to authenticated
with check ("supervisorId"=auth.uid() and public.owns_trainee("traineeId",auth.uid()) and status='pending');
create policy tasks_update on public.tasks for update to authenticated
using ("traineeId"=auth.uid() and public.owns_trainee(auth.uid(),"supervisorId"))
with check ("traineeId"=auth.uid() and public.owns_trainee(auth.uid(),"supervisorId"));
create policy reports_read on public.reports for select to authenticated
using (("traineeId"=auth.uid() or "supervisorId"=auth.uid()) and public.owns_trainee("traineeId","supervisorId"));
create policy reports_insert on public.reports for insert to authenticated
with check ("traineeId"=auth.uid() and public.owns_trainee(auth.uid(),"supervisorId") and date <= (now() at time zone 'Asia/Riyadh')::date);
create policy reports_update on public.reports for update to authenticated
using ("traineeId"=auth.uid() and public.owns_trainee(auth.uid(),"supervisorId"))
with check ("traineeId"=auth.uid() and public.owns_trainee(auth.uid(),"supervisorId"));
commit;
