---
trigger: always_on
description: "Reglas de arquitectura, seguridad, bases de datos y verificación para UTM Desk NoSQL Cloud."
---

# Reglas de desarrollo — UTM Desk NoSQL Cloud

## 1. Flujo de trabajo
- Antes de modificar código, inspecciona los archivos relacionados y comprende el comportamiento existente.
- Para cambios importantes, presenta primero un plan breve con archivos afectados, riesgos y pruebas.
- Realiza cambios pequeños y coherentes con la arquitectura actual.
- No refactorices módulos ajenos a la tarea sin una razón justificada.
- No afirmes que una prueba pasó si no la ejecutaste.

## 2. Next.js y documentación
- Antes de escribir o cambiar código de Next.js, consulta la documentación local pertinente en `node_modules/next/dist/docs/`, resolviendo su ubicación desde el directorio correspondiente.
- Respeta las APIs y convenciones de la versión instalada.
- No elimines ni alteres los bloques generados automáticamente en `AGENTS.md` por Next.js.
- No introduzcas configuraciones heredadas sin verificar su compatibilidad.

## 3. MongoDB Atlas
- Mantén alineados los esquemas Zod, los modelos de la aplicación y las reglas `$jsonSchema` de MongoDB.
- Verifica los tipos, campos requeridos, enumeraciones e índices antes de conectar una nueva operación.
- Justifica los índices según las consultas reales.
- No ejecutes operaciones destructivas ni modifiques datos remotos sin autorización explícita.
- No asumas que los datos de producción son datos de prueba.

## 4. Upstash Redis y folios
- Respeta la asignación atómica mediante `INCR` y la separación de contadores por año.
- Analiza concurrencia, reintentos, timeouts y fallos entre Redis y MongoDB.
- No supongas que Redis y MongoDB comparten una transacción.
- No prometas folios sin huecos si el diseño no ofrece esa garantía.
- No cambies el formato de los folios sin revisar la compatibilidad con los registros existentes.

## 5. Supabase Storage
- Mantén las credenciales de servicio exclusivamente en el servidor.
- Comprueba la autenticación y los permisos antes de permitir el acceso a archivos.
- Valida tamaño y tipo de los archivos.
- Utiliza URLs firmadas temporales y analiza los fallos parciales entre la carga del archivo y el registro de la incidencia.

## 6. API y seguridad
- Valida todas las entradas recibidas en los Route Handlers.
- Nunca confíes exclusivamente en una cabecera proporcionada por el cliente, como `x-user-role`, para conceder permisos.
- Verifica la identidad y la autorización en el servidor.
- No expongas secretos, tokens, contraseñas ni cadenas de conexión.
- No implementes autenticación de forma improvisada: revisa primero los mecanismos existentes y sus dependencias.

## 7. Verificación
- Ejecuta las pruebas relevantes disponibles después de los cambios.
- Ejecuta TypeScript, ESLint y las pruebas automatizadas pertinentes cuando estén configuradas.
- Comprueba respuestas HTTP, permisos insuficientes, entradas inválidas y errores de servicios externos.
- Revisa el diff para detectar cambios accidentales.
- Distingue claramente entre comprobaciones ejecutadas, resultados observados y riesgos pendientes.

## 8. Herramientas y operaciones externas
- Utiliza MCP y otras herramientas solo cuando aporten valor a la tarea.
- Aplica el principio de permisos mínimos.
- Antes de ejecutar operaciones remotas de escritura, sembrado o modificación de datos, explica el alcance y solicita autorización explícita.
- No interpretes un `--dry-run` como prueba de que una operación remota completa funciona correctamente.