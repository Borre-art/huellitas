'use strict';
(() => {
 const U=window.CartillaUtils, $=s=>document.querySelector(s), esc=U.escape;
 const tables={pets:'huellitas_mascotas',records:'huellitas_registros',documents:'huellitas_documentos'};
 const bucket='huellitas-privado', icons={perro:'🐶',gato:'🐱',conejo:'🐰',otro:'🐾'};
 const docTypes={foto:'Foto',cartilla:'Cartilla',receta:'Receta',estudio:'Estudio',otro:'Documento'};
 let client,user=null,pets=[],records=[],documents=[],selected='',authMode='login';
 let generation=0,authRevision=0,recovery=false,loading=false,busy=false;
 const localError=text=>Object.assign(new Error(text),{local:true});
 function message(el,text='',error=false){el.textContent=text;el.classList.toggle('error',error);if(el.id==='app-message')el.hidden=!text;}
 function explain(error){
  const messages={invalid_credentials:'El correo o la contraseña no coinciden.',email_not_confirmed:'Confirma tu correo antes de entrar. Revisa también spam.',email_address_invalid:'El servicio rechazó esta dirección. Revisa cómo la escribiste y usa un correo al que tengas acceso.',
   email_address_not_authorized:'El envío de confirmaciones está restringido. Contacta al administrador de Huellitas.',
   over_email_send_rate_limit:'Se alcanzó el límite temporal de correos. Espera antes de volver a solicitar la confirmación.',over_request_rate_limit:'Espera un momento y vuelve a intentar.',weak_password:'Elige una contraseña más larga y difícil de adivinar.',user_already_exists:'Esta cuenta ya existe. Inicia sesión o recupera tu contraseña.',signup_disabled:'El registro de cuentas no está disponible en este momento.','42501':'No se pudo autorizar la operación. Vuelve a iniciar sesión.','23503':'La mascota ya no está disponible. Actualiza la lista.',PGRST116:'El registro ya no está disponible. Actualiza la página.','23514':'Revisa las fechas y el formato de los datos.',PGRST205:'Las cartillas todavía no están disponibles. Inténtalo más tarde.'};
  if(messages[error?.code])return messages[error.code];
  if(/fetch|network/i.test(error?.message||''))return 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo; conserva el formulario abierto.';
  return error?.local?error.message:'No se pudo completar la operación. Inténtalo de nuevo o vuelve a iniciar sesión.';
 }
 async function result(request){const r=await request;if(r.error)throw r.error;return r.data;}
 async function run(button,task,output=$('#app-message')){
  if(busy)return;busy=true;const label=button?.textContent;
  if(button){button.disabled=true;button.textContent='Un momento…';}message(output);
  try{await task();}catch(error){const dialog=output.closest('dialog');message(dialog&&!dialog.open?$('#app-message'):output,explain(error),true);}
  finally{busy=false;if(button){button.disabled=false;if(button.textContent==='Un momento…')button.textContent=label;}}
 }
 async function readAll(name,owner){
  const all=[];
  for(let offset=0;;offset+=1000){const rows=await result(client.from(name).select('*').eq('propietario_id',owner).order('id').range(offset,offset+999));all.push(...rows);if(rows.length<1000)return all;}
 }
 function clearPrivate(){
  pets=[];records=[];documents=[];selected='';
  ['#pet-list','#pet-detail','#upcoming-list','#print-sheet'].forEach(s=>$(s).replaceChildren());
  $('#account-email').textContent='';
  ['#stat-pets','#stat-pending','#stat-documents'].forEach(s=>$(s).textContent='0');
  $('#download-link').removeAttribute('href');
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  ['#pet-form','#record-form','#document-form'].forEach(s=>$(s).reset());
 }
 async function loadData(){
  if(!user)return;
  const owner=user.id,ticket=++generation;loading=true;$('#refresh').disabled=true;
  try{
   const data=await Promise.all([readAll(tables.pets,owner),readAll(tables.records,owner),readAll(tables.documents,owner)]);
   if(ticket!==generation||user?.id!==owner)return;
   [pets,records,documents]=data;pets.sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));render();
  }finally{if(ticket===generation){loading=false;$('#refresh').disabled=false;}}
 }
 async function setSession(session){
  const next=session?.user||null;
  if(next?.id!==user?.id){generation++;clearPrivate();}
  user=next;$('#auth-panel').hidden=!!user&&!recovery;$('#account-panel').hidden=!user||recovery;
  if(!user){loading=false;return;}
  $('#account-email').textContent=user.email||'Sesión iniciada';
  if(!recovery){try{await loadData();}catch(e){message($('#app-message'),explain(e),true);}}
 }
 function switchAuth(mode){
  authMode=mode;const reset=mode==='reset',update=mode==='update',signup=mode==='signup';
  $('#auth-title').textContent=reset?'Recupera tu cuenta':update?'Elige tu nueva contraseña':signup?'Crea tu cuenta':'Entra a tu cuenta';
  $('#auth-submit').textContent=reset?'Enviar enlace':update?'Guardar contraseña':signup?'Crear mi cuenta':'Entrar';
  $('#auth-choices').hidden=update;$('#email-label').hidden=update;$('#auth-email').required=!update;
  $('#password-label').hidden=reset;$('#auth-password').required=!reset;
  $('#auth-password').autocomplete=signup||update?'new-password':'current-password';$('#auth-password').value='';
  $('#forgot-password').hidden=update;$('#forgot-password').textContent=reset?'Volver a iniciar sesión':'Olvidé mi contraseña';
  document.querySelectorAll('[data-auth]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.auth===mode)));
  message($('#auth-message'));
 }
 function button(action,label,id='',classes='text-link'){return '<button type="button" class="'+classes+'" data-action="'+action+'" data-id="'+esc(id)+'">'+label+'</button>';}
 function render(){
  const visible=pets.filter(p=>$('#show-archived').checked||!p.archivada);
  if(!visible.some(p=>p.id===selected))selected=visible[0]?.id||'';
  $('#stat-pets').textContent=String(pets.filter(p=>!p.archivada).length);
  const due=U.pending(records,pets);$('#stat-pending').textContent=String(due.length);$('#stat-documents').textContent=String(documents.length);
  $('#pet-list').innerHTML=visible.map(p=>'<button type="button" class="pet-card" data-select="'+esc(p.id)+'" aria-pressed="'+(p.id===selected)+'"><span aria-hidden="true">'+icons[p.especie]+'</span><div><strong>'+esc(p.nombre)+'</strong><small>'+esc(U.species[p.especie])+(p.archivada?' · Archivada':'')+'</small></div></button>').join('')||'<p class="small">Todavía no hay mascotas aquí.</p>';
  renderDetail();
  $('#upcoming-list').innerHTML=due.map(r=>{
   const p=pets.find(p=>p.id===r.mascota_id);
   return '<article class="due-row"><div><strong>'+esc(p.nombre)+' · '+esc(r.titulo)+'</strong><p class="due-date '+(r.estado==='Pendiente desde'?'overdue':'')+'">'+r.estado+' · '+U.formatDate(r.proxima_fecha)+'</p></div><div class="actions">'+button('select-pet','Ver cartilla',p.id)+button('complete','Marcar atendido',r.id,'secondary')+'</div></article>';
  }).join('')||'<p class="empty-inline">No hay cuidados pendientes. Agrega una próxima fecha a cualquier registro.</p>';
 }
 function renderDetail(filter=''){
  const p=pets.find(p=>p.id===selected);
  if(!p){$('#pet-detail').innerHTML='<div class="empty"><span aria-hidden="true">♡</span><h2>Su historia empieza aquí</h2><p>Agrega tu primera mascota para crear su cartilla.</p>'+button('new-pet','Agregar mascota','','button')+'</div>';return;}
  const history=records.filter(r=>r.mascota_id===p.id).sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.created_at.localeCompare(a.created_at));
  const files=documents.filter(d=>d.mascota_id===p.id).sort((a,b)=>b.created_at.localeCompare(a.created_at)),weight=history.find(r=>r.tipo==='peso');
  const recordHTML=history.filter(r=>!filter||r.tipo===filter).map(r=>'<article class="record"><div class="record-head"><div><span class="badge">'+U.kinds[r.tipo]+'</span><h4>'+esc(r.titulo)+'</h4></div><time datetime="'+esc(r.fecha)+'">'+U.formatDate(r.fecha)+'</time></div>'+(r.tipo==='peso'?'<p><strong>'+esc(r.peso_kg)+' kg</strong></p>':'')+(r.veterinario?'<p class="record-meta">'+esc(r.veterinario)+'</p>':'')+(r.notas?'<p>'+esc(r.notas)+'</p>':'')+(r.proxima_fecha?'<p class="record-meta">Próxima fecha: '+U.formatDate(r.proxima_fecha)+(r.seguimiento_completado?' · Atendida':'')+'</p>':'')+'<div class="record-actions">'+button('edit-record','Editar',r.id)+button('delete-record','Eliminar',r.id,'text-link danger')+'</div></article>').join('');
  const fileHTML=files.map(d=>'<article class="document"><div><strong>'+esc(d.nombre)+'</strong><small>'+docTypes[d.tipo]+' · '+(d.size_bytes/1048576).toFixed(2)+' MB</small></div><div class="actions">'+button('download','Descargar',d.id)+button('delete-document','Eliminar',d.id,'text-link danger')+'</div></article>').join('');
  $('#pet-detail').innerHTML='<div class="pet-cover"><div class="pet-avatar" id="pet-avatar" aria-hidden="true">'+icons[p.especie]+'</div><div class="pet-title"><h2>'+esc(p.nombre)+'</h2><p>'+U.species[p.especie]+(p.raza?' · '+esc(p.raza):'')+' · '+(p.sexo==='desconocido'?'Sexo sin registrar':esc(p.sexo))+'</p><p>'+(p.nacimiento?'Nacimiento aprox.: '+U.formatDate(p.nacimiento):'Nacimiento sin registrar')+(p.esterilizada?' · Esterilizada/o':'')+'</p>'+(weight?'<p>Último peso: '+esc(weight.peso_kg)+' kg · '+U.formatDate(weight.fecha)+'</p>':'')+(p.archivada?'<p><strong>Ficha archivada</strong></p>':'')+'</div></div>'+
   '<div class="pet-controls">'+button('edit-pet','Editar ficha')+button('print','Imprimir / guardar PDF')+button('archive',p.archivada?'Restaurar mascota':'Archivar mascota')+'</div>'+(p.notas?'<p class="pet-notes"><strong>Notas importantes</strong><br>'+esc(p.notas)+'</p>':'')+
   '<div class="cartilla-body"><div class="record-toolbar"><h3>Historial de salud</h3>'+(p.archivada?'':button('new-record','+ Agregar registro','','secondary'))+'</div><label class="history-filter">Filtrar registros<select id="history-filter"><option value="">Todos los registros</option>'+Object.entries(U.kinds).map(([k,v])=>'<option value="'+k+'" '+(k===filter?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'+
   '<div class="record-list">'+(recordHTML||'<p class="empty-inline">Sin registros para mostrar. Agrega una vacuna, consulta o medición de peso.</p>')+'</div><div class="record-toolbar"><h3>Documentos</h3>'+(p.archivada?'':button('new-document','+ Subir archivo','','secondary'))+'</div><div class="document-list">'+(fileHTML||'<p class="empty-inline">Guarda una foto de tu mascota, su cartilla física o un documento del veterinario.</p>')+'</div></div>';
  const photo=files.find(d=>d.tipo==='foto'&&d.mime_type.startsWith('image/'));
  if(photo)showPhoto(photo,p.id,generation);
 }
 async function showPhoto(photo,petId,ticket){
  try{
   const data=await result(client.storage.from(bucket).createSignedUrl(photo.ruta,600));
   if(selected!==petId||ticket!==generation||!user)return;
   const avatar=$('#pet-avatar');if(!avatar)return;
   const img=document.createElement('img');img.className='pet-avatar';img.alt='Foto de tu mascota';img.src=data.signedUrl;
   img.addEventListener('error',()=>img.replaceWith(avatar),{once:true});avatar.replaceWith(img);
  }catch{/* La cartilla sigue disponible aunque no se pueda cargar la foto. */}
 }
 function openForm(id,values={}){
  const form=$(id+' form');form.reset();
  for(const [key,value]of Object.entries(values)){const field=form.elements.namedItem(key);if(!field)continue;if(field.type==='checkbox')field.checked=Boolean(value);else field.value=value??'';}
  message(form.querySelector('.form-message'));$(id).showModal();
 }
 function openPet(p){$('#pet-dialog-title').textContent=p?'Editar mascota':'Agregar mascota';$('#pet-form [name=nacimiento]').max=U.today();openForm('#pet-dialog',p||{});}
 function syncWeight(){const weight=$('#record-form [name=tipo]').value==='peso';$('#weight-field').hidden=!weight;$('#record-form [name=peso_kg]').required=weight;}
 function openRecord(r){$('#record-dialog-title').textContent=r?'Editar registro':'Agregar registro';$('#record-form [name=fecha]').max=U.today();openForm('#record-dialog',r||{mascota_id:selected,fecha:U.today()});syncWeight();}
 function confirmAction(title,description,label){
  return new Promise(resolve=>{const d=$('#confirm-dialog');$('#confirm-title').textContent=title;$('#confirm-description').textContent=description;$('#confirm-ok').textContent=label;d.returnValue='cancel';d.addEventListener('close',()=>resolve(d.returnValue==='ok'),{once:true});d.showModal();});
 }
 function printPet(){
  const p=pets.find(p=>p.id===selected);if(!p)return;
  const history=records.filter(r=>r.mascota_id===p.id).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  $('#print-sheet').innerHTML='<p>huellitas. · Cartilla personal</p><h1>'+esc(p.nombre)+'</h1><p>'+U.species[p.especie]+' · '+esc(p.raza||'Raza sin registrar')+' · '+esc(p.sexo)+'<br>Nacimiento aproximado: '+(p.nacimiento?U.formatDate(p.nacimiento):'Sin registrar')+' · Esterilizada/o: '+(p.esterilizada?'Sí':'No registrado como esterilizado')+'</p><h2>Notas importantes</h2><p class="print-notes">'+esc(p.notas||'Sin notas')+'</p><h2>Historial de salud</h2><table><thead><tr><th>Fecha</th><th>Registro</th><th>Observaciones</th><th>Próxima fecha</th></tr></thead><tbody>'+
   (history.map(r=>'<tr><td>'+U.formatDate(r.fecha)+'</td><td>'+U.kinds[r.tipo]+'<br>'+esc(r.titulo)+(r.peso_kg?'<br>'+esc(r.peso_kg)+' kg':'')+'</td><td class="print-notes">'+esc(r.veterinario)+(r.veterinario?'\n':'')+esc(r.notas)+'</td><td>'+(r.proxima_fecha?U.formatDate(r.proxima_fecha):'—')+(r.seguimiento_completado?' · Atendida':'')+'</td></tr>').join('')||'<tr><td colspan="4">Sin registros</td></tr>')+
   '</tbody></table><p>Generada el '+U.formatDate(U.today())+'. Información registrada por el dueño. Los comprobantes originales están en Documentos.</p>';
  window.print();
 }
 async function perform(action,id,b){
  if(!user||loading||busy)return;const p=pets.find(p=>p.id===selected),owner=user.id;
  if(action==='new-pet')return openPet();
  if(action==='edit-pet')return openPet(p);
  if(action==='new-record')return openRecord();
  if(action==='edit-record')return openRecord(records.find(r=>r.id===id));
  if(action==='new-document')return openForm('#document-dialog',{mascota_id:selected});
  if(action==='select-pet'){selected=id;render();$('#pet-detail').scrollIntoView({block:'start'});return;}
  if(action==='print')return printPet();
  if(action==='archive'){
   if(!await confirmAction(p.archivada?'Restaurar mascota':'Archivar mascota',p.archivada?'Su cartilla volverá a la lista de mascotas activas.':'Su historial se conservará. Puedes restaurarla activando “Ver archivadas”.',p.archivada?'Restaurar':'Archivar'))return;
   if(user?.id!==owner)return;
   return run(b,async()=>{await result(client.from(tables.pets).update({archivada:!p.archivada}).eq('id',p.id).eq('propietario_id',owner).select('id').single());await loadData();message($('#app-message'),'Ficha actualizada.');});
  }
  if(action==='complete')return run(b,async()=>{await result(client.from(tables.records).update({seguimiento_completado:true}).eq('id',id).eq('propietario_id',owner).select('id').single());await loadData();message($('#app-message'),'Cuidado marcado como atendido. Puedes cambiarlo al editar el registro.');});
  if(action==='delete-record'){
   if(!await confirmAction('Eliminar registro','Este registro se eliminará de la cartilla. Esta acción no se puede deshacer.','Eliminar'))return;
   if(user?.id!==owner)return;
   return run(b,async()=>{await result(client.from(tables.records).delete().eq('id',id).eq('propietario_id',owner).select('id').single());await loadData();message($('#app-message'),'Registro eliminado.');});
  }
  const doc=documents.find(d=>d.id===id);
  if(action==='download'&&doc)return run(b,async()=>{const data=await result(client.storage.from(bucket).createSignedUrl(doc.ruta,60,{download:true}));if(user?.id!==owner)return;const url=new URL(data.signedUrl);if(url.protocol!=='https:')throw localError('No se pudo preparar el enlace.');$('#download-link').href=data.signedUrl;$('#download-dialog').showModal();});
  if(action==='delete-document'&&doc){
   if(!await confirmAction('Eliminar documento','“'+doc.nombre+'” y su archivo se eliminarán. Esta acción no se puede deshacer.','Eliminar'))return;
   if(user?.id!==owner)return;
   return run(b,async()=>{await result(client.storage.from(bucket).remove([doc.ruta]));await result(client.from(tables.documents).delete().eq('id',doc.id).eq('propietario_id',owner).select('id').single());await loadData();message($('#app-message'),'Documento eliminado.');});
  }
 }
 document.querySelectorAll('[data-auth]').forEach(b=>b.addEventListener('click',()=>{if(!busy)switchAuth(b.dataset.auth);}));
 $('#forgot-password').addEventListener('click',()=>{if(!busy)switchAuth(authMode==='reset'?'login':'reset');});
 $('#auth-form').addEventListener('submit',event=>{
  event.preventDefault();if(!client)return;
  const email=$('#auth-email').value.trim(),password=$('#auth-password').value,mode=authMode,redirectTo=new URL('mascotas.html',window.location.href).href;
  run($('#auth-submit'),async()=>{
   if(mode==='reset'){await result(client.auth.resetPasswordForEmail(email,{redirectTo}));message($('#auth-message'),'Si la cuenta existe, recibirás un enlace para recuperar tu contraseña. Revisa tu correo y spam.');return;}
   if(mode==='update'){await result(client.auth.updateUser({password}));recovery=false;switchAuth('login');await setSession((await result(client.auth.getSession())).session);message($('#app-message'),'Contraseña actualizada.');return;}
   if(mode==='signup'){
    const data=await result(client.auth.signUp({email,password,options:{emailRedirectTo:redirectTo}}));$('#auth-password').value='';
    if(data.session)await setSession(data.session);else message($('#auth-message'),'Revisa tu correo para confirmar tu cuenta. Si ya tienes cuenta, usa “Iniciar sesión”.');
   }else{const data=await result(client.auth.signInWithPassword({email,password}));$('#auth-password').value='';message($('#app-message'));await setSession(data.session);}
  },$('#auth-message'));
 });
 $('#logout').addEventListener('click',()=>run($('#logout'),async()=>{await result(client.auth.signOut({scope:'local'}));recovery=false;await setSession(null);switchAuth('login');message($('#app-message'),'Cerraste sesión en este dispositivo.');}));
 $('#refresh').addEventListener('click',()=>run($('#refresh'),loadData));
 $('#add-pet').addEventListener('click',()=>{if(user&&!busy&&!loading)openPet();});
 $('#show-archived').addEventListener('change',render);
 $('#pet-list').addEventListener('click',event=>{const b=event.target.closest('[data-select]');if(b){selected=b.dataset.select;render();}});
 $('#account-panel').addEventListener('click',event=>{const b=event.target.closest('[data-action]');if(b)perform(b.dataset.action,b.dataset.id,b).catch(e=>message($('#app-message'),explain(e),true));});
 $('#pet-detail').addEventListener('change',e=>{if(e.target.id==='history-filter')renderDetail(e.target.value);});
 document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{if(!busy)b.closest('dialog').close();}));
 document.querySelectorAll('dialog').forEach(d=>d.addEventListener('cancel',e=>{if(busy)e.preventDefault();}));
 $('#record-form [name=tipo]').addEventListener('change',syncWeight);
 $('#pet-form').addEventListener('submit',event=>{
  event.preventDefault();if(!user)return;const form=event.currentTarget,f=new FormData(form),owner=user.id;
  run(form.querySelector('[type=submit]'),async()=>{
   const payload={nombre:f.get('nombre').trim(),especie:f.get('especie'),raza:f.get('raza').trim(),sexo:f.get('sexo'),nacimiento:f.get('nacimiento')||null,esterilizada:f.has('esterilizada'),notas:f.get('notas').trim()};
   if(!payload.nombre)throw localError('Escribe el nombre de tu mascota.');
   if(payload.nacimiento&&(!U.validDate(payload.nacimiento)||payload.nacimiento>U.today()))throw localError('Revisa la fecha de nacimiento.');
   const request=f.get('id')?client.from(tables.pets).update(payload).eq('id',f.get('id')).eq('propietario_id',owner):client.from(tables.pets).insert({...payload,propietario_id:owner});
   const data=await result(request.select('id').single());if(user?.id!==owner)return;
   selected=data.id;$('#pet-dialog').close();await loadData();message($('#app-message'),'Mascota guardada en tu cuenta.');
  },form.querySelector('.form-message'));
 });
 $('#record-form').addEventListener('submit',event=>{
  event.preventDefault();if(!user)return;const form=event.currentTarget,f=new FormData(form),owner=user.id;
  run(form.querySelector('[type=submit]'),async()=>{
   const payload={mascota_id:f.get('mascota_id'),tipo:f.get('tipo'),titulo:f.get('titulo').trim(),fecha:f.get('fecha'),proxima_fecha:f.get('proxima_fecha')||null,seguimiento_completado:!!f.get('proxima_fecha')&&f.has('seguimiento_completado'),peso_kg:f.get('tipo')==='peso'?Number(f.get('peso_kg')):null,veterinario:f.get('veterinario').trim(),notas:f.get('notas').trim()};
   try{U.validateRecord(payload);}catch(e){throw localError(e.message);}
   const request=f.get('id')?client.from(tables.records).update(payload).eq('id',f.get('id')).eq('propietario_id',owner):client.from(tables.records).insert({...payload,propietario_id:owner});
   await result(request.select('id').single());if(user?.id!==owner)return;
   $('#record-dialog').close();await loadData();message($('#app-message'),'Registro guardado en la cartilla.');
  },form.querySelector('.form-message'));
 });
 $('#document-form').addEventListener('submit',event=>{
  event.preventDefault();if(!user)return;const form=event.currentTarget,f=new FormData(form),owner=user.id;
  run(form.querySelector('[type=submit]'),async()=>{
   const file=f.get('archivo');let extension;try{extension=U.fileExtension(file);}catch(e){throw localError(e.message);}
   if(f.get('tipo')==='foto'&&!file.type.startsWith('image/'))throw localError('Elige una imagen para la foto de tu mascota.');
   if(!f.get('nombre').trim())throw localError('Escribe un nombre para el documento.');
   const path=owner+'/'+f.get('mascota_id')+'/'+crypto.randomUUID()+'.'+extension;
   await result(client.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false,cacheControl:'600'}));
   try{await result(client.from(tables.documents).insert({propietario_id:owner,mascota_id:f.get('mascota_id'),nombre:f.get('nombre').trim(),tipo:f.get('tipo'),ruta:path,mime_type:file.type,size_bytes:file.size}).select('id').single());}
   catch(error){const cleanup=await client.storage.from(bucket).remove([path]);if(cleanup.error)throw localError('La subida quedó incompleta y no se agregó a la cartilla. Contacta al administrador antes de repetirla.');throw error;}
   if(user?.id!==owner)return;
   $('#document-dialog').close();await loadData();message($('#app-message'),'Documento guardado de forma privada.');
  },form.querySelector('.form-message'));
 });
 async function init(){
  const c=window.HUELLITAS_CONFIG;
  if(!c?.supabaseUrl||!c?.supabasePublishableKey){message($('#app-message'),'Estamos preparando las cuentas y cartillas. El acceso estará disponible pronto. Puedes seguir consultando las guías de cuidados.');return;}
  if(!window.supabase){message($('#app-message'),'No se pudo cargar el acceso. Revisa tu conexión y vuelve a cargar la página.',true);return;}
  const url=new URL(c.supabaseUrl);if(url.protocol!=='https:'||!c.supabasePublishableKey.startsWith('sb_publishable_'))throw localError('El acceso a cuentas no está disponible en este momento.');
  client=window.supabase.createClient(c.supabaseUrl,c.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  client.auth.onAuthStateChange((event,session)=>{
   if(event==='PASSWORD_RECOVERY'){recovery=true;switchAuth('update');}
   if(event==='SIGNED_OUT'){generation++;user=null;recovery=false;clearPrivate();$('#account-panel').hidden=true;$('#auth-panel').hidden=false;switchAuth('login');}
   if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','PASSWORD_RECOVERY','USER_UPDATED'].includes(event)){
    const revision=++authRevision;setTimeout(()=>{if(revision===authRevision)setSession(session);},0);
   }
  });
  const initialRevision=authRevision,data=await result(client.auth.getSession());$('#auth-fields').disabled=false;
  if(initialRevision===authRevision)await setSession(data.session);
  const hash=new URLSearchParams(window.location.hash.slice(1));
  if(hash.has('error')){message($('#app-message'),'El enlace expiró o no es válido. Solicita uno nuevo.',true);history.replaceState(null,'',window.location.pathname);}
 }
 init().catch(e=>message($('#app-message'),explain(e),true));
})();
