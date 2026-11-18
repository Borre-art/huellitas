-- Instalación inicial. Ejecutar una sola vez en el proyecto elegido.
begin;
create table public.huellitas_mascotas (
 id uuid primary key default gen_random_uuid(),
 propietario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 nombre text not null check(length(trim(nombre)) between 1 and 80),
 especie text not null check(especie in ('perro','gato','conejo','otro')),
 raza text not null default '' check(length(raza)<=100),
 sexo text not null default 'desconocido' check(sexo in ('macho','hembra','desconocido')),
 nacimiento date,
 esterilizada boolean not null default false,
 notas text not null default '' check(length(notas)<=4000),
 archivada boolean not null default false,
 created_at timestamptz not null default now(),
 unique(id,propietario_id)
);
create index huellitas_mascotas_propietario_idx on public.huellitas_mascotas(propietario_id);
create table public.huellitas_registros (
 id uuid primary key default gen_random_uuid(),
 mascota_id uuid not null,
 propietario_id uuid not null default auth.uid(),
 tipo text not null check(tipo in ('vacuna','desparasitacion','consulta','tratamiento','peso')),
 titulo text not null check(length(trim(titulo)) between 1 and 120),
 fecha date not null,
 proxima_fecha date check(proxima_fecha>=fecha),
 seguimiento_completado boolean not null default false,
 peso_kg numeric(7,3) check(peso_kg>0 and peso_kg<=1000),
 veterinario text not null default '' check(length(veterinario)<=160),
 notas text not null default '' check(length(notas)<=4000),
 created_at timestamptz not null default now(),
 foreign key(mascota_id,propietario_id) references public.huellitas_mascotas(id,propietario_id) on delete cascade,
 check(tipo<>'peso' or peso_kg is not null)
);
create index huellitas_registros_propietario_fecha_idx on public.huellitas_registros(propietario_id,proxima_fecha);
create index huellitas_registros_mascota_idx on public.huellitas_registros(mascota_id,propietario_id);
create table public.huellitas_documentos (
 id uuid primary key default gen_random_uuid(),
 mascota_id uuid not null,
 propietario_id uuid not null default auth.uid(),
 nombre text not null check(length(trim(nombre)) between 1 and 180),
 tipo text not null check(tipo in ('foto','cartilla','receta','estudio','otro')),
 ruta text not null unique,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
 size_bytes integer not null check(size_bytes>0 and size_bytes<=10485760),
 created_at timestamptz not null default now(),
 foreign key(mascota_id,propietario_id) references public.huellitas_mascotas(id,propietario_id) on delete cascade,
 check(split_part(ruta,'/',1)=propietario_id::text and split_part(ruta,'/',2)=mascota_id::text),
 check(tipo<>'foto' or mime_type like 'image/%')
);
create index huellitas_documentos_propietario_idx on public.huellitas_documentos(propietario_id);
create index huellitas_documentos_mascota_idx on public.huellitas_documentos(mascota_id,propietario_id);
alter table public.huellitas_mascotas enable row level security;
alter table public.huellitas_registros enable row level security;
alter table public.huellitas_documentos enable row level security;
revoke all on public.huellitas_mascotas,public.huellitas_registros,public.huellitas_documentos from anon;
grant select,insert,update,delete on public.huellitas_mascotas,public.huellitas_registros,public.huellitas_documentos to authenticated;
create policy huellitas_mascotas_propias on public.huellitas_mascotas for all to authenticated
 using(propietario_id=(select auth.uid())) with check(propietario_id=(select auth.uid()));
create policy huellitas_registros_propios on public.huellitas_registros for all to authenticated
 using(propietario_id=(select auth.uid())) with check(propietario_id=(select auth.uid()));
create policy huellitas_documentos_propios on public.huellitas_documentos for all to authenticated
 using(propietario_id=(select auth.uid())) with check(propietario_id=(select auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('huellitas-privado','huellitas-privado',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy huellitas_archivos_lectura on storage.objects for select to authenticated
 using(bucket_id='huellitas-privado' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy huellitas_archivos_creacion on storage.objects for insert to authenticated
 with check(bucket_id='huellitas-privado' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.huellitas_mascotas m where m.id::text=(storage.foldername(name))[2] and m.propietario_id=(select auth.uid()) and not m.archivada));
create policy huellitas_archivos_eliminacion on storage.objects for delete to authenticated
 using(bucket_id='huellitas-privado' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Las subidas usan rutas UUID nuevas; no necesitan permisos UPDATE ni upsert.
commit;
