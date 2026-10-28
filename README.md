# UTM Desk NoSQL Cloud

Sistema institucional universitario de mesa de ayuda y gestión operativa de incidencias para el campus de la **Universidad Tecnológica Metropolitana (UTM)**. 

Desarrollado con una arquitectura moderna de nube híbrida basada en **Next.js (App Router)**, **MongoDB Atlas (M0)** como base de datos documental con esquemas estrictos `$jsonSchema`, **Upstash Redis** para concurrencia atómica de folios institucionales y **Supabase Storage** para la gestión de evidencias multimedia.

---

## 🏛️ 1. Arquitectura y Stack Tecnológico

```
                          ┌──────────────────────────────────────┐
                          │     Next.js 16 + React 19 + TS       │
                          │   (Turbopack · App Router · RBAC)    │
                          └───────────────┬──────────────────────┘
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            │                             │                             │
            ▼                             ▼                             ▼
┌────────────────────────┐   ┌────────────────────────┐   ┌────────────────────────┐
│   MongoDB Atlas (M0)   │   │   Upstash Redis REST   │   │    Supabase Storage    │
│  Colecciones BSON      │   │   Contadores Atómicos  │   │  Evidencias Multimedia │
│  Validación $jsonSchema│   │   Folios INC-AAAA-NNNN │   │  Imágenes y PDFs       │
│  Índices TTL y Texto   │   │   INCRBY Concurrente   │   │  URLs Firmadas         │
└────────────────────────┘   └────────────────────────┘   └────────────────────────┘
```

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Framework Web** | Next.js 16.4.2 (App Router) | Renderizado híbrido, server actions, endpoints API REST y enrutamiento optimizado con Turbopack. |
| **Lenguaje** | TypeScript 5 & React 19 | Tipado estático de extremo a extremo e interfaces declarativas. |
| **Estilos** | Tailwind CSS | Diseño responsivo, accesible y con estética institucional. |
| **Base de Datos NoSQL** | MongoDB Atlas M0 (`utm_desk_db`) | Almacenamiento persistente documental, esquemas `$jsonSchema`, índices compuestos, texto ponderado y TTL. |
| **Caché y Concurrencia** | Upstash Redis (REST API) | Generación atómica no bloqueante de correlativos anuales de incidencias (`INC-AAAA-NNNN`). |
| **Almacenamiento Objeto**| Supabase Storage | Bucket para evidencias fotográficas y reportes técnicos en PDF. |
| **Seguridad y Cifrado** | bcryptjs / Jose | Cifrado seguro de contraseñas de usuarios institucionales y firmas de sesión. |

---

## 📁 2. Estructura del Proyecto

```text
utm-desk-nosql-cloud/
├── app/                              # Next.js App Router
│   ├── api/
│   │   └── health/route.ts           # Endpoint de salud en tiempo real (MongoDB + Redis)
│   ├── activos/                      # Gestión de activos de campus
│   ├── analitica/                    # Métricas de resolución y rendimiento
│   ├── incidencias/                  # Bandeja general y detalle de incidencias
│   │   └── nueva/page.tsx            # Formulario de alta con detalle polimórfico
│   ├── login/page.tsx                # Pantalla de inicio de sesión institucional
│   ├── mis-incidencias/              # Portal de autoservicio para reportantes
│   ├── monitoreo/                    # Monitoreo operativo del campus
│   ├── portal/                       # Dashboard principal según rol RBAC
│   ├── globals.css                   # Estilos globales y utilidades
│   └── layout.tsx                    # Shell base de la aplicación y SessionProvider
├── components/
│   └── auth/
│       └── SessionProvider.tsx       # Proveedor de sesión y control de acceso (RBAC)
├── lib/                              # Módulos núcleo de infraestructura
│   ├── mongodb.ts                    # Singleton de MongoClient, pools y sanitización de errores
│   ├── redis.ts                      # Singleton de Upstash Redis, folios atómicos y sanitización
│   └── rbac.ts                       # Definiciones de roles y matriz de permisos
├── scripts/
│   └── setup-db-and-seed.ts          # Script maestro: creación de esquemas, índices y 25 incidencias
├── .env.example                      # Plantilla de variables de entorno requeridas
├── .env.local                        # Variables de entorno locales (ignorado por Git)
├── package.json                      # Scripts de npm y dependencias del proyecto
└── tsconfig.json                     # Configuración estricta de TypeScript
```

---

## 🔐 3. Modelo de Roles y Control de Acceso (RBAC)

El sistema implementa 5 roles institucionales con permisos estrictamente diferenciados:

| Rol | Correo Demo (Frontend) | ID en Base de Datos | Alcance y Vistas Autorizadas |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@utm.edu.mx` | `ADM-0311` | Acceso irrestricto a todas las rutas, auditoría y configuraciones. |
| **Directiva** | `directiva@utm.edu.mx` | `DIR-0014` | Acceso a `/analitica` y consulta general de `/incidencias` del campus. |
| **Coordinador** | `coordinador@utm.edu.mx` | `CRD-0105` | Asignación y balanceo de tickets, `/activos`, `/monitoreo`, `/incidencias`. |
| **Técnico** | `tecnico@utm.edu.mx` | `TEC-0205` / `TEC-0412` / `TEC-0518` | Diagnóstico, registro de horas, cambio de estado y resolución en su área técnica asignada. |
| **Reportante** | `reportante@utm.edu.mx` | `DOC-1042` / `ADM-0422` / `EST-2024` | Portal de autoservicio (`/mis-incidencias`), alta de reportes (`/incidencias/nueva`). |

> **Contraseña Demo en Frontend:** `utm-demo`  
> **Contraseña Sembrada en MongoDB:** Definida mediante la variable de entorno `SEED_DEFAULT_PASSWORD`. Cada desarrollador debe configurar su propia contraseña en `.env.local` antes de ejecutar la inicialización de la base de datos.

---

## 🗄️ 4. Modelo de Datos en MongoDB Atlas (`utm_desk_db`)

### 4.1 Colección `usuarios`
Almacena la identidad de la comunidad universitaria.
- **Validador `$jsonSchema` estricto:**
  - `id_usuario`: Expresión regular `^(ADM|DIR|CRD|TEC|DOC|EST)-[0-9]{4}$`.
  - `correo`: Expresión regular `^[a-zA-Z0-9._%+-]+@utm\.edu\.mx$`.
  - `rol`: `["admin", "directiva", "coordinador", "tecnico", "reportante"]`.
  - `area_asignada` (obligatorio para técnicos): `["computo_redes", "infraestructura", "academico"]`.
  - `rol_institucional` (obligatorio para reportantes): `["Docente", "Estudiante", "Administrativo"]`.
- **Índices Oficiales:**
  - `idx_usuarios_correo_unico`: `{ correo: 1 }` (Único).
  - `idx_usuarios_clave_unica`: `{ id_usuario: 1 }` (Único).
  - `idx_usuarios_rol_area`: `{ rol: 1, area_asignada: 1 }`.

### 4.2 Colección `incidencias_campus`
Almacena el ciclo de vida de los reportes, tracking de tiempos y polimorfismo operativo.
- **Validador `$jsonSchema` polimórfico:**
  - `folio`: Expresión regular `^INC-[0-9]{4}-[0-9]{4}$`.
  - `categoria`: `["computo_redes", "infraestructura", "academico"]`.
  - `prioridad`: `["baja", "media", "alta", "critica"]`.
  - `estado`: `["abierta", "en_proceso", "en_espera", "resuelta", "cerrada"]`.
  - Subdocumento condicional `detalle_especifico`:
    - **`computo_redes`:** `direccion_ip`, `vlan` (1 a 4094), `puerto_uplink`, `equipos_afectados` (>= 1).
    - **`infraestructura`:** `tipo_dano`, `riesgo_seguridad` (`Bajo`, `Medio`, `Alto`, `Critico`), `requiere_insumos`, `contratista_externo`.
    - **`academico`:** `plataforma`, `codigo_curso`, `periodo_escolar`, `estudiantes_impactados` (>= 1).
  - Array `historial_seguimiento`: Bitácora inmutable con `fecha`, `autor`, `estado_nuevo`, `horas_sumadas` y `comentario`.
  - Array `evidencias_adjuntas`: Metadatos con `id_evidencia`, `nombre_archivo`, `tipo_mime`, `peso_kb` y `storage_key`.
- **Índices Oficiales y Optimizados:**
  - `idx_folio_unico`: `{ folio: 1 }` (Único).
  - `idx_compuesto_cat_est_edif`: `{ categoria: 1, estado: 1, "ubicacion.edificio": 1 }`.
  - `idx_ttl_resolucion_60dias`: `{ fecha_resolucion: 1 }` (`expireAfterSeconds: 5184000` = 60 días).
  - `idx_fulltext_es_ponderado`: `{ titulo: "text", descripcion: "text" }` en español con ponderación `titulo: 10`, `descripcion: 5`.
  - `idx_reportante_usuario`: `{ "reportante.id_usuario": 1 }`.
  - `idx_tecnico_estado`: `{ "tecnico_asignado.id_usuario": 1, estado: 1 }` *(auxiliar justificado para bandejas de trabajo de técnicos)*.
  - `idx_reportante_fecha`: `{ "reportante.id_usuario": 1, fecha_creacion: -1 }` *(auxiliar justificado para orden cronológico en `/mis-incidencias`)*.

---

## ⚡ 5. Integración con Upstash Redis (Contador Atómico)

Para garantizar la integridad estricta del consecutivo anual de folios sin riesgo de duplicados por concurrencia:
- **Estructura de clave:** `contador:incidencias:AAAA` (ejemplo: `contador:incidencias:2026`).
- **Operación atómica:** Se utiliza `INCR` directamente en la creación de tickets.
- **Guardia de límite:** Si el contador supera `9999`, el código arroja una excepción controlada antes de intentar insertar en MongoDB, protegiendo contra errores de esquema BSON.
- **Regla crítica de sincronización (`ensureCounterAtLeast`):**
  - Solo lee el valor actual con `GET`.
  - Si el valor de Redis ya es mayor o igual al máximo de MongoDB, **no escribe nada** para no revertir folios emitidos.
  - Si es menor, ejecuta un `INCRBY` por la diferencia exacta (`targetVal - previous`).
  - **Jamás utiliza `SET` con valores menores ni decrementa el contador.**

---

## 🛡️ 6. Endpoint de Monitoreo de Salud (`/api/health`)

El endpoint `/api/health` permite la inspección en tiempo real de la conectividad en la nube:

- **Ruta:** `GET http://localhost:3000/api/health`
- **Manejo:** Ejecución en paralelo con `Promise.all` entre MongoDB y Redis.
- **Códigos de respuesta:**
  - `200 OK`: Ambos servicios responden correctamente (`status: "healthy"`).
  - `503 Service Unavailable`: Uno o ambos servicios fallan (`status: "degraded"` o `"unhealthy"`).
- **Sanitización de seguridad:** Todos los mensajes de error aplican filtros por expresiones regulares para anonimizar credenciales, usuarios, contraseñas, tokens Bearer y URLs antes de responder.

---

## 🚀 7. Guía de Instalación y Uso Local

### 7.1 Requisitos Previos
- **Node.js** >= 20.x
- **npm** >= 10.x
- Clúster en **MongoDB Atlas** (M0 gratuito configurado con Network Access).
- Base de datos en **Upstash Redis** (acceso REST API habilitado).

### 7.2 Configuración del Entorno
Copia la plantilla y configura tus credenciales reales:
```bash
cp .env.example .env.local
```

Configura en `.env.local`:
```env
# MongoDB Atlas
MONGODB_URI="mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB="utm_desk_db"

# Upstash Redis REST
UPSTASH_REDIS_REST_URL="https://<tu-endpoint>.upstash.io"
UPSTASH_REDIS_REST_TOKEN="<tu-token-rest>"

# Autenticación y Semillas (cada desarrollador debe configurar su propia SEED_DEFAULT_PASSWORD en .env.local)
AUTH_SECRET="<clave-secreta-aleatoria-de-32-caracteres>"
SEED_DEFAULT_PASSWORD="<tu-contraseña-segura-para-usuarios-sembrados>"

# Supabase Storage (Opcional en fase inicial)
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
```

### 7.3 Comandos Disponibles

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo en http://localhost:3000
npm run dev

# Ejecutar comprobación de tipos TypeScript
npx tsc --noEmit

# Ejecutar análisis de calidad de código con ESLint
npm run lint

# Verificación inofensiva de guardas del script de base de datos (Dry-Run local)
npx tsx scripts/setup-db-and-seed.ts --dry-run

# Ejecutar el sembrado oficial en la nube (MongoDB Atlas + Upstash Redis)
npm run db:seed
```

---

## 📊 8. Detalles del Sembrado Maestro (`scripts/setup-db-and-seed.ts`)

El script maestro de inicialización garantiza:
1. **Idempotencia total:** Verifica la preexistencia de cada usuario por `id_usuario` / `correo`, y de cada incidencia por `folio`. Reejecutar el comando no genera duplicados ni corrompe colecciones.
2. **Cero destrucción:** No ejecuta `dropDatabase()`, `collection.drop()` ni `deleteMany()`.
3. **Distribución balanceada de las 25 incidencias:**
   - 9 incidencias de Cómputo y Redes (Edificio K).
   - 8 incidencias de Infraestructura (Edificios F y A).
   - 8 incidencias Académicas (Biblioteca Central y laboratorios).
   - 10 incidencias resueltas/cerradas con fechas dinámicas relativas (`Date.now() - 2 a 7 días`), asegurando que el índice TTL de 60 días no las elimine antes de la entrega académica (> 15 de diciembre de 2026).
   - 15 incidencias en curso sin `fecha_resolucion` (no expiran).
   - 15 incidencias con metadatos simulados de evidencias adjuntas.
4. **Sincronización final:** Calibra el contador de Redis `contador:incidencias:2026` exactamente al máximo de folio registrado (`25`).

---

## 👥 9. Equipo de Desarrollo y Créditos
- **Proyecto:** UTM Desk NoSQL Cloud
- **Institución:** Universidad Tecnológica Metropolitana (UTM)
- **División:** Tecnologías de la Información y Comunicación
- **Rama Oficial de Backend:** `dev/angel` (Responsable: Ángel Gabriel Noh Camargo)
