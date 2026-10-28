# Guía Técnica de Integración Backend — dev/angel
**UTM Desk NoSQL Cloud • Unidad II (Bases de Datos en la Nube)**
**Responsable Técnico:** Angel Gabriel Noh Camargo (Backend 1 — Base de Datos Cloud y Escritura)

---

## 1. Alcance y Responsabilidades del Rol

En conformidad con el **Plan de División de Trabajo** oficial:
- **Infraestructura Base:** Clúster MongoDB Atlas M0 (`utm_desk_db`) y servidor Upstash Redis.
- **Modelado Documental:** Validadores formales `$jsonSchema` con discriminador polimórfico `oneOf` para `incidencias_campus` y `usuarios`.
- **Estrategia de Indexación:** Definición de los 3 índices obligatorios (Compuesto, TTL de 60 días y Full-Text ponderado en español) e índices auxiliares.
- **Concurrencia y Atomicidad:** Asignación de folios consecutivos con comando atómico `INCR` en Upstash Redis (`contador:incidencias:AAAA`) sin condiciones de carrera.
- **Script Maestro de Poblado:** `scripts/setup-db-and-seed.ts` ejecutable vía `npm run db:seed` para inicializar colecciones, esquemas, índices y 25 incidencias sintéticas de prueba.
- **Monitoreo de Conectividad:** Endpoint `/api/health` con verificación viva de latencia contra MongoDB y Redis.

---

## 2. Pilares de la Arquitectura Documental NoSQL

1. **Modelo Polimórfico sin Campos Nulos:** La colección principal `incidencias_campus` unifica los atributos transversales en la raíz y encapsula los atributos específicos en el subdocumento `detalle_especifico`:
   - `computo_redes`: `direccion_ip`, `vlan` (int 1-4094), `puerto_uplink`, `equipos_afectados` (int >= 1).
   - `infraestructura`: `tipo_dano`, `riesgo_seguridad` (Enum: Bajo, Medio, Alto, Critico), `requiere_insumos`, `insumos_solicitados`, `contratista_externo`.
   - `academico`: `plataforma`, `codigo_curso`, `periodo_escolar`, `estudiantes_impactados` (int >= 1).
2. **Localidad de Datos en una Operación I/O:** Los objetos embebidos `reportante`, `ubicacion` y los arreglos `tags[]`, `historial_seguimiento[]` y `evidencias_adjuntas[]` permiten leer el expediente completo con una única lectura BSON sin `JOIN`s relacionales.
3. **Desacoplamiento Multimedia:** Los archivos binarios pesados se delegan a Supabase Storage para respetar la cuota de 512 MB del clúster Atlas M0 (RNF-01), persistiendo únicamente `storage_key` y metadatos técnicos en MongoDB.

---

## 3. Catálogo de Colecciones e Índices

### Colección: `usuarios`
- **Validador:** `$jsonSchema` estricto con `oneOf` según el rol institucional.
- **Índices:**
  - `idx_usuarios_correo_unico`: `{ correo: 1 }`, `unique: true`
  - `idx_usuarios_clave_unica`: `{ id_usuario: 1 }`, `unique: true`
  - `idx_usuarios_rol_area`: `{ rol: 1, area_asignada: 1 }`

### Colección: `incidencias_campus`
- **Validador:** `$jsonSchema` estricto con `oneOf` que valida exhaustivamente cada una de las 3 categorías con `additionalProperties: false` dentro de `detalle_especifico`.
- **Índices Obligatorios:**
  1. **Compuesto:** `{ categoria: 1, estado: 1, "ubicacion.edificio": 1 }` (Nombre: `idx_compuesto_cat_est_edif`) — Optimiza filtros y vistas de bandeja operativa.
  2. **TTL (Time-To-Live):** `{ fecha_resolucion: 1 }` con `expireAfterSeconds: 5184000` (Nombre: `idx_ttl_resolucion_60dias`) — Purgado automático de tickets resueltos transcurridos 60 días naturales (RF-07).
  3. **Full-Text:** `{ titulo: "text", descripcion: "text" }` con `default_language: "spanish"` y pesos `{ titulo: 10, descripcion: 5 }` (Nombre: `idx_fulltext_es_ponderado`) — Permite búsqueda lingüística con relevancia `textScore` (RF-05 / CU-05).
- **Índices Auxiliares:**
  - `idx_folio_unico`: `{ folio: 1 }`, `unique: true`
  - `idx_reportante_usuario`: `{ "reportante.id_usuario": 1 }`

---

## 4. Concurrencia y Generación de Folios en Redis

- **Clave:** `contador:incidencias:2026`
- **Mecanismo:** Comando atómico `INCR`.
- **Formato:** `INC-2026-NNNN` (ejemplo: `INC-2026-0001` a `INC-2026-0025`).
- **Garantía:** Elimina condiciones de carrera entre usuarios concurrentes sin necesidad de locks distribuidos ni transacciones pesadas en MongoDB.

---

## 5. Configuración de Variables de Entorno

El archivo `.env.local` debe configurarse con las siguientes variables:

```bash
# MongoDB Atlas
MONGODB_URI="mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB="utm_desk_db"

# Upstash Redis
UPSTASH_REDIS_REST_URL="https://<instancia>.upstash.io"
UPSTASH_REDIS_REST_TOKEN="<token_upstash>"

# Autenticación y Semillas
AUTH_SECRET="<secreto_criptografico_de_sesion>"
SEED_DEFAULT_PASSWORD="<password_para_usuarios_demo>"

# Supabase Storage (Módulo Backend 2)
SUPABASE_URL="https://<proyecto>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service_role_key>"
```

> **Aviso de Seguridad:**
> El archivo `.env.local` se encuentra estrictamente excluido en `.gitignore`. Jamás publiques, envíes o comitees credenciales privadas a Git.

---

## 6. Ejecución del Script Maestro de Sembrado

Para preparar las colecciones, aplicar validadores, crear índices y sembrar las 25 incidencias de demostración:

```bash
npm run db:seed
```

### Características de Seguridad del Script
- **Idempotente:** Puede ejecutarse múltiples veces consecutivas.
- **No destructivo:** No elimina colecciones, no trunca bases de datos y no borra datos preexistentes.
- **Protección del contador:** Evalúa los folios existentes en MongoDB y el valor de Redis para nunca decrementar la secuencia.
- **Sanitización de logs:** Oculta contraseñas y URIs sensibles en la salida de consola.

---

## 7. Verificación de Salud del Sistema (/api/health)

Inicia el servidor de desarrollo:

```bash
npm run dev
```

En otra terminal o mediante el navegador / Postman / cURL:

```bash
curl -i http://localhost:3000/api/health
```

### Respuesta esperada (HTTP 200 OK):

```json
{
  "status": "healthy",
  "timestamp": "2026-10-27T18:45:00.000Z",
  "services": {
    "mongodb": {
      "status": "connected",
      "database": "utm_desk_db",
      "latency_ms": 42
    },
    "redis": {
      "status": "connected",
      "latency_ms": 15
    }
  }
}
```

Si alguna variable no está configurada o el servicio remoto está inalcanzable, la ruta responderá con código `503 Service Unavailable` indicando el estatus `"error"` del servicio sin filtrar contraseñas o tokens.
