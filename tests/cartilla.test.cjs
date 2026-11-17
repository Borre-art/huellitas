const U=require('../cartilla-utils.js');
let count=0;
function ok(value,label){if(!value)throw new Error(label);count++;}
function throws(fn,label){let failed=false;try{fn();}catch{failed=true;}ok(failed,label);}
ok(U.today(new Date(2026,10,6,23,59))==='2026-11-06','Fecha local con ceros');
ok(U.validDate('2024-02-29'),'Año bisiesto válido');
ok(!U.validDate('2026-02-29'),'Rechazar día imposible');
ok(!U.validDate('2026-13-01'),'Rechazar mes imposible');
ok(!U.validDate('2026-2-01'),'Formato de fecha estricto');
const base={tipo:'vacuna',titulo:'Control',fecha:'2026-11-01',proxima_fecha:'2026-11-10'};
ok(U.validateRecord({...base},'2026-11-16').titulo==='Control','Aceptar registro pasado');
throws(()=>U.validateRecord({...base,fecha:'2026-12-01'},'2026-11-16'),'Rechazar aplicación futura');
throws(()=>U.validateRecord({...base,proxima_fecha:'2026-10-01'},'2026-11-16'),'Rechazar seguimiento anterior');
throws(()=>U.validateRecord({...base,titulo:'  '},'2026-11-16'),'Rechazar título vacío');
throws(()=>U.validateRecord({...base,tipo:'peso',peso_kg:NaN},'2026-11-16'),'Rechazar peso no numérico');
throws(()=>U.validateRecord({...base,tipo:'peso',peso_kg:0},'2026-11-16'),'Rechazar peso cero');
ok(U.validateRecord({...base,tipo:'peso',peso_kg:5.2},'2026-11-16').peso_kg===5.2,'Peso decimal válido');
const p=[{id:'a',archivada:false},{id:'b',archivada:true}];
const r=[
 {id:1,mascota_id:'a',proxima_fecha:'2026-11-18',seguimiento_completado:false},
 {id:2,mascota_id:'a',proxima_fecha:'2026-11-15',seguimiento_completado:false},
 {id:3,mascota_id:'a',proxima_fecha:'2026-11-16',seguimiento_completado:false},
 {id:4,mascota_id:'a',proxima_fecha:'2026-11-14',seguimiento_completado:true},
 {id:5,mascota_id:'b',proxima_fecha:'2026-11-14',seguimiento_completado:false},
 {id:6,mascota_id:'c',proxima_fecha:'2026-11-14',seguimiento_completado:false}
];
const due=U.pending(r,p,'2026-11-16');
ok(JSON.stringify(due.map(x=>x.id))==='[2,3,1]','Excluir atendidos, archivados y mascotas ajenas; ordenar');
ok(JSON.stringify(due.map(x=>x.estado))==='["Pendiente desde","Hoy","Próximo"]','Clasificar vencimiento sin hora UTC');
ok(U.escape('<img src=x onerror="alert(1)">')==='&lt;img src=x onerror=&quot;alert(1)&quot;&gt;','Escapar HTML no confiable');
ok(U.escape("'&")==='&#39;&amp;','Escapar atributos y ampersand');
ok(U.fileExtension({type:'application/pdf',size:10485760})==='pdf','Aceptar límite de 10 MB');
throws(()=>U.fileExtension({type:'image/svg+xml',size:10}),'Rechazar SVG activo');
throws(()=>U.fileExtension({type:'image/png',size:10485761}),'Rechazar archivo excesivo');
throws(()=>U.fileExtension({type:'image/png',size:0}),'Rechazar archivo vacío');
console.log(count+' pruebas de validación superadas.');
