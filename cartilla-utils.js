(function(root,factory){
 const utils=factory();
 if(typeof module==='object'&&module.exports)module.exports=utils;else root.CartillaUtils=utils;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const kinds={vacuna:'Vacuna',desparasitacion:'Desparasitación',consulta:'Consulta',tratamiento:'Tratamiento',peso:'Peso'};
 const species={perro:'Perro',gato:'Gato',conejo:'Conejo',otro:'Otra especie'};
 function escape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function today(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
 function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
 function formatDate(value){return validDate(value)?new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value+'T12:00:00')):'Sin fecha';}
 function dueState(value,date=today()){return value<date?'Pendiente desde':value===date?'Hoy':'Próximo';}
 function pending(records,pets,date=today()){const active=new Set(pets.filter(p=>!p.archivada).map(p=>p.id));return records.filter(r=>active.has(r.mascota_id)&&r.proxima_fecha&&!r.seguimiento_completado).sort((a,b)=>a.proxima_fecha.localeCompare(b.proxima_fecha)).map(r=>({...r,estado:dueState(r.proxima_fecha,date)}));}
 function validateRecord(r,date=today()){
  if(!kinds[r.tipo])throw new Error('Selecciona un tipo de registro válido.');
  if(!r.titulo.trim())throw new Error('Escribe un título.');
  if(!validDate(r.fecha)||r.fecha>date)throw new Error('La fecha del registro debe ser válida y no estar en el futuro.');
  if(r.proxima_fecha&&(!validDate(r.proxima_fecha)||r.proxima_fecha<r.fecha))throw new Error('La próxima fecha debe ser igual o posterior al registro.');
  if(r.tipo==='peso'&&!(Number.isFinite(r.peso_kg)&&r.peso_kg>0&&r.peso_kg<=1000))throw new Error('Escribe un peso válido en kg.');
  return r;
 }
 function fileExtension(file){const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'};if(!types[file.type])throw new Error('Usa JPG, PNG, WebP o PDF.');if(!file.size||file.size>10485760)throw new Error('El archivo debe pesar entre 1 byte y 10 MB.');return types[file.type];}
 return {kinds,species,escape,today,validDate,formatDate,dueState,pending,validateRecord,fileExtension};
});
