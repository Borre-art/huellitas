-- Pruebas transaccionales de aislamiento. Requiere schema.sql.
-- Usuarios ficticios; no se envían correos y al terminar se revierte todo.
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
insert into public.huellitas_mascotas(id,nombre,especie) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Prueba A','gato');
insert into public.huellitas_registros(id,mascota_id,tipo,titulo,fecha) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','vacuna','Prueba vacuna',current_date);
insert into public.huellitas_documentos(id,mascota_id,nombre,tipo,ruta,mime_type,size_bytes)
 values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Prueba privada','cartilla',
 '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/prueba.pdf','application/pdf',100);
insert into storage.objects(bucket_id,name) values('huellitas-privado','11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/prueba.pdf');
do $$ begin
 if (select count(*) from public.huellitas_mascotas)<>1 then raise exception 'El dueño no puede leer su mascota'; end if;
 if (select count(*) from public.huellitas_registros)<>1 then raise exception 'El dueño no puede leer su cartilla'; end if;
 if (select count(*) from public.huellitas_documentos)<>1 then raise exception 'El dueño no puede leer sus documentos'; end if;
 if (select count(*) from storage.objects where bucket_id='huellitas-privado')<>1 then raise exception 'El dueño no puede leer su archivo'; end if;
end $$;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$ declare n integer; begin
 if exists(select 1 from public.huellitas_mascotas) then raise exception 'Fuga de mascotas entre usuarios'; end if;
 if exists(select 1 from public.huellitas_registros) then raise exception 'Fuga de cartillas entre usuarios'; end if;
 if exists(select 1 from public.huellitas_documentos) then raise exception 'Fuga de documentos entre usuarios'; end if;
 if exists(select 1 from storage.objects where bucket_id='huellitas-privado') then raise exception 'Fuga de archivos entre usuarios'; end if;
 update public.huellitas_mascotas set nombre='Ataque' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 get diagnostics n=row_count; if n<>0 then raise exception 'Modificación de mascota ajena'; end if;
 delete from public.huellitas_registros where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 get diagnostics n=row_count; if n<>0 then raise exception 'Borrado de cartilla ajena'; end if;
 delete from storage.objects where bucket_id='huellitas-privado';
 get diagnostics n=row_count; if n<>0 then raise exception 'Borrado de archivo ajeno'; end if;
 begin
  insert into public.huellitas_mascotas(propietario_id,nombre,especie) values('11111111-1111-4111-8111-111111111111','Falsificado','gato');
  raise exception 'Permite falsificar dueño';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.huellitas_registros(mascota_id,tipo,titulo,fecha) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','consulta','Intrusión',current_date);
  raise exception 'Permite registrar en mascota ajena';
 exception when foreign_key_violation then null; end;
 begin
  insert into storage.objects(bucket_id,name) values('huellitas-privado','11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/falso.pdf');
  raise exception 'Permite subir a carpeta ajena';
 exception when insufficient_privilege then null; end;
 begin
  insert into storage.objects(bucket_id,name) values('huellitas-privado','22222222-2222-4222-8222-222222222222/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/falso.pdf');
  raise exception 'Permite subir para mascota ajena';
 exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$ begin
 begin
  update public.huellitas_mascotas set propietario_id='22222222-2222-4222-8222-222222222222' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  raise exception 'Permite transferir dueño sin autorización';
 exception when insufficient_privilege then null; end;
end $$;
update public.huellitas_registros set notas='Actualizado por dueño' where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
do $$ begin
 if not exists(select 1 from public.huellitas_registros where notas='Actualizado por dueño') then raise exception 'UPDATE propio falló'; end if;
end $$;
set local role anon;
set local request.jwt.claim.sub='';
do $$ begin
 begin perform 1 from public.huellitas_mascotas; raise exception 'Lectura pública de mascotas'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.huellitas_registros; raise exception 'Lectura pública de cartillas'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.huellitas_documentos; raise exception 'Lectura pública de documentos'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
