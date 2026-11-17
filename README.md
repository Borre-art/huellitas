# Huellitas

Sitio: https://borre-art.github.io/huellitas/

HTML, CSS y JavaScript, publicado con GitHub Pages desde `main` y la carpeta raíz.

## Cartillas privadas

La rama `codex/cartillas-supabase` agrega:
- Cuentas por correo, inicio/cierre de sesión, confirmación de correo y recuperación de contraseña.
- Varias mascotas por cuenta, edición, archivado y restauración.
- Vacunas, desparasitaciones, consultas, tratamientos y registro de peso.
- Próximas fechas con estado pendiente/atendido.
- Fotos y documentos privados (JPG, PNG, WebP y PDF, hasta 10 MB).
- Impresión de la cartilla y opción Guardar como PDF del navegador.

Las guías y la rutina diaria original continúan disponibles. La rutina original sigue guardándose localmente por especie; las nuevas cartillas usan Supabase.

## Estado de activación

**El código está preparado, pero la base remota no ha sido instalada ni conectada.** No se debe integrar a producción hasta completar la configuración y las verificaciones descritas abajo. `config.js` está deliberadamente vacío: la página informa que el acceso aún no está disponible y desactiva los formularios.

## Arquitectura

- `mascotas.html`, `cartilla.css`: interfaz adaptable al celular, con el estilo original.
- `cartilla.js`: integración con Supabase Auth, Data API y Storage.
- `cartilla-utils.js`: validación de fechas, peso, adjuntos y escape de texto.
- `supabase/schema.sql`: instalación SQL inicial atómica, tres tablas y bucket privado.
- Cliente Supabase JS fijado a `2.119.0` desde jsDelivr. No hay compilación ni servidor Node en producción.

Supabase gestiona el backend. PostgreSQL aplica RLS al propietario autenticado y las claves foráneas compuestas impiden asociar un registro o documento a una mascota de otro dueño. Los archivos usan rutas de dueño/mascota/UUID y enlaces temporales. No se almacena la cartilla en localStorage: el SDK sí conserva la sesión del usuario en el dispositivo.

## Activación en el proyecto Supabase elegido

1. Confirmar qué proyecto se usará e inspeccionar sus tablas y políticas existentes. Los objetos nuevos tienen el prefijo `huellitas_`; la tabla de la práctica anterior no se modifica.
2. Ejecutar una sola vez `supabase/schema.sql`. Si hay nombres en conflicto, revisar el esquema antes de ejecutar; el script no elimina ni reemplaza datos existentes.
3. En Authentication, habilitar el proveedor Email y mantener la confirmación de correo. Configurar:
   - Site URL: `https://borre-art.github.io/huellitas/`
   - Redirect URL: `https://borre-art.github.io/huellitas/mascotas.html`
4. Verificar la entrega de correos de confirmación y recuperación. El correo predeterminado de Supabase tiene restricciones; para usuarios reales puede necesitarse un SMTP configurado. No desactivar la confirmación para ocultar un problema de entrega.
5. Completar `config.js` con la URL del proyecto y una clave **publishable** (`sb_publishable_...`). Ambas son configuración pública del frontend. Nunca colocar claves secretas, `service_role`, contraseña de PostgreSQL ni tokens de administración en el repositorio.
6. Verificar RLS y permisos en el proyecto real, revisar los avisos de seguridad de Supabase y hacer las pruebas de aceptación.
7. Integrar la rama en `main` solo cuando la configuración y las pruebas estén completas. GitHub Pages publicará los archivos.

No hay acceso de administrador en la web, perfiles públicos ni enlaces públicos de cartillas. El archivado conserva la información; la eliminación de registros/documentos pide confirmación.

## Verificación reproducible

```sh
node --check cartilla.js
node --check cartilla-utils.js
node tests/cartilla.test.cjs
```

El workflow `Cartillas - validación y privacidad` corre en pull requests con PostgreSQL 17 aislado:
1. `tests/database-bootstrap.sql` crea un contrato mínimo de Auth y Storage **solo para CI**.
2. Instala el esquema.
3. `tests/ownership.sql` comprueba accesos del dueño, bloqueo del otro usuario, intento de falsificar dueño, asociación a mascotas ajenas, rutas de archivos y acceso anónimo. Sus datos se revierten al finalizar.

Estas pruebas comprueban SQL/RLS, pero no sustituyen la prueba real de Supabase Auth, Storage ni el navegador. **Nunca ejecutar database-bootstrap.sql en un proyecto Supabase real.**

Prueba de aceptación pendiente en el despliegue:
- Registrar y confirmar una cuenta; recuperar contraseña usando el enlace recibido.
- Crear dos mascotas, agregar/editar/eliminar un registro y recargar: deben persistir.
- Entrar en otro dispositivo y comprobar la misma información.
- Entrar con una segunda cuenta y comprobar que no puede leer ni modificar IDs o archivos de la primera.
- Subir foto/PDF, descargarlo con enlace temporal, rechazar formato/tamaño inválido y eliminarlo.
- Archivar/restaurar una mascota; verificar próximos cuidados, filtro e impresión.
- Revisar teclado, diálogos, celular y errores de conexión sin perder el formulario.

## Límites de esta versión

- Los próximos cuidados aparecen dentro de la web. No se envían recordatorios automáticos por correo.
- El PDF se genera con la función de impresión del navegador; las imágenes/PDF adjuntos se descargan por separado.
- Las cartillas contienen información proporcionada por el dueño, sin validación veterinaria automática.
- No se implementa eliminación de cuentas ni transferencia de mascotas.
