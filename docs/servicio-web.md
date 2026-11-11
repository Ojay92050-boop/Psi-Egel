# Servicio de acceso web

La validación utiliza el mismo servicio de Google Apps Script del desarrollo. Se ha preparado la compatibilidad del puente para orígenes HTTPS de un solo subdominio terminado exactamente en .netlify.app. Incluye el dominio de producción y los Deploy Previews. Los dominios ajenos, HTTP público y puertos HTTPS alternativos siguen rechazados. La versión local y Android conservan sus orígenes existentes.

La cuenta propietaria sigue administrando los usuarios desde EGELACC. Ningún archivo administrativo, contraseña ni clave del banco se incluye en este repositorio.

Si conectas un dominio propio en lugar de la dirección .netlify.app, su origen exacto deberá autorizarse también en allowedParent del archivo Acceso.html del servicio de Google. No hace falta ese cambio para la dirección predeterminada de Netlify.

La compatibilidad quedó publicada en la versión 17 del servicio existente el 10 de noviembre de 2026. No cambió la dirección del servicio ni se crearon accesos de prueba en la hoja real.
