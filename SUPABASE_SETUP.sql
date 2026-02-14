-- 1. Tabla de Perfiles (Extiende auth.users)
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  username text unique,
  full_name text,
  role text check (role in ('admin', 'supervisor', 'dev')),
  is_active boolean default true,
  last_login timestamp with time zone,
  created_at timestamp with time zone default now(),
  primary key (id)
);

-- 2. Habilitar RLS en profiles
alter table public.profiles enable row level security;

-- Política: Todos pueden ver perfiles
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

-- Política: Usuarios pueden actualizar su propio perfil
create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- 3. Tabla de Logs de Actividad
create table public.activity_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  username text,
  action text not null, -- LOGIN, UPDATE, CREATE, DELETE, ERROR
  resource text not null, -- PROMPTS, USERS, AUTH, BRAIN
  description text,
  status text check (status in ('OK', 'ERROR', 'PENDING')),
  metadata jsonb,
  ip_address text,
  created_at timestamp with time zone default now()
);

-- 4. Habilitar RLS en logs
alter table public.activity_logs enable row level security;

-- Política: Solo admins pueden ver todos los logs, usuarios normales solo los suyos
create policy "Admins view all logs, users view own"
  on activity_logs for select
  using ( 
    auth.uid() in (select id from profiles where role = 'admin') 
    or auth.uid() = user_id 
  );

-- Política: Sistema puede insertar logs (abierto para este demo, ajustar en prod)
create policy "System insert logs"
  on activity_logs for insert
  with check ( true );

-- 5. Trigger para crear perfil automático al registrar usuario (opcional pero recomendado)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name, role)
  values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'full_name', 'supervisor');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();