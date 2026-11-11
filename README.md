# PSI Estudio · versión web

Aplicación lista para subir a GitHub y publicar en Netlify. Conserva el banco cifrado de **4,500 preguntas** y la validación con el servicio de Google Apps Script ya configurado.

## Publicar desde GitHub

1. Crea un repositorio y sube **todo el contenido de esta carpeta**, incluido netlify.toml y la carpeta public. El archivo README.md debe quedar en la raíz del repositorio.
2. En Netlify, crea un proyecto importando ese repositorio de GitHub.
3. Usa estos ajustes si Netlify los solicita:

| Ajuste | Valor |
| --- | --- |
| Directorio base | Vacío: raíz del repositorio |
| Comando de compilación | Vacío: no se necesita |
| Directorio de publicación | public |

4. Publica y comparte la dirección HTTPS estable de producción terminada en .netlify.app que te dé Netlify. La configuración también está incluida en netlify.toml.

No necesitas variables de entorno, claves de API ni copiar el código administrativo de Google a Netlify.

## Qué funciona

- Inicio de sesión con los usuarios y claves que administras en EGELACC.
- Cuentas Z: equipos autorizados y una sola sesión activa, según tu configuración.
- Muestras PSI: periodos de acceso y límites de hasta 150 equipos y 150 sesiones por usuario temporal.
- Sesiones de 30 a 100 preguntas, cuatro dificultades, explicaciones y progreso por área.
- Acceso desde computadora y navegador móvil; descarga de los archivos de estudio.

El acceso requiere internet. La hoja y el servicio de Google siguen siendo parte del funcionamiento; Netlify aloja la página pública.

Para usar un dominio propio, consulta docs/servicio-web.md: el servicio debe autorizar su origen exacto.

## Primer acceso desde la web

La nueva dirección web tiene su propio almacenamiento. Para las cuentas Z normales, este navegador puede necesitar el código de **Autorizar otro equipo** que generas desde tu panel. Las muestras registran el equipo automáticamente hasta su límite. No cambies la dirección de producción entre sesiones.

El progreso del HTML local o de la APK no se transfiere automáticamente al nuevo dominio. La web guarda el progreso en el navegador que se usa para estudiar. Un navegador diferente, otro dominio o borrar sus datos supone otro registro de equipo.

## Actualizaciones

Después de editar archivos y subir los cambios a la rama conectada de GitHub, Netlify puede volver a publicarlos. Mantén la misma dirección de producción para conservar el registro del navegador y su progreso.

## Prueba local opcional

Con Node.js 22 o posterior instalado:

```sh
npm test
npm start
```

Abre la dirección que muestre la vista previa. No requiere instalar paquetes. No abras index.html con doble clic: la aplicación está preparada para un servidor web.

## Archivos

- public/index.html: entrada de la aplicación y banco cifrado.
- public/assets/app.js: apertura segura del banco y control de sesión del cliente.
- public/assets/app.css: presentación responsive.
- public/_headers: cabeceras para Netlify.
- netlify.toml: publicación de la carpeta public.
- tests/web.test.mjs: comprobaciones con permisos y banco sintéticos; no contiene credenciales reales.

## Verificación y límites

Verificaciones realizadas: **13 pruebas de este paquete aprobadas**, **106 pruebas del servicio aprobadas** y formulario de inicio de sesión habilitado desde la vista previa web. El paquete comprueba apertura, integridad, origen de los mensajes, vencimiento de permisos y configuración de publicación. La publicación en una cuenta real de Netlify y el acceso con una cuenta de cliente real deben comprobarse después de desplegar. Las pruebas de 150 sesiones del servicio son automatizadas: no equivalen a una prueba de carga con 150 dispositivos reales.

Documentación oficial de la configuración: https://docs.netlify.com/build/configure-builds/file-based-configuration/
