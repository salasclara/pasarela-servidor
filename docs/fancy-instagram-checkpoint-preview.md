# Instagram web-first: checkpoint aislado

Prototipo desactivado, sin conexión al scheduler ni cambios de configuración. Registra el ID del contenedor en el payload PostgreSQL antes de consultar su estado y enviar. Las respuestas inciertas quedan en outcome_unknown, sin reintento automático. No activar en producción: faltan integración con horarios, revisión de permisos de Meta, manejo de procesos interrumpidos en estado sending, prueba de concurrencia y prueba real autorizada. 

Pruebas: node test/fancy-instagram-checkpoint-preview.test.js. La prueba test/fancy-instagram-pglite.test.js requiere instalar @electric-sql/pglite en un entorno de pruebas aislado; no depende de Railway ni modifica datos de producción.

## Interrupciones

Un trabajo en `sending` no puede reservarse otra vez. Puede representar una operación que llegó a Meta o que se interrumpió antes del envío. Debe revisarse manualmente usando el ID de contenedor registrado y los registros de la cuenta; nunca se debe reenviar automáticamente. La simulación con PostgreSQL embebido cubre dos solicitudes simultáneas dentro de un proceso; sigue pendiente una prueba con varios procesos y un servidor PostgreSQL independiente, además de una herramienta autorizada de conciliación. No cambiar estados directamente como parte de esta prueba.
