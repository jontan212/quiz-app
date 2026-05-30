# Quiz App

Aplicación web para realizar tests personalizados de estudio. Permite seleccionar asignaturas y temas, configurar temporizadores, y llevar un historial detallado de resultados con estadísticas.

## Características

- **Dos modos de test**: repaso rápido (feedback inmediato por pregunta) y modo examen (corrección al final)
- **Temporizadores**: por pregunta (15 s–90 s) o global para todo el test (1–180 min)
- **Preguntas con imágenes**: tanto el enunciado como las opciones de respuesta admiten imágenes
- **Estadísticas detalladas**: historial de sesiones, evolución gráfica, racha de aciertos, preguntas más falladas y rendimiento por asignatura
- **Panel de administración**: crear preguntas manualmente o importarlas desde un CSV, gestionar asignaturas y temas
- **Detección de duplicados**: al importar, identifica duplicados exactos y conflictivos (mismo enunciado, opciones distintas)
- **Dark mode**: automático según el sistema, con opción manual
- **Diseño responsive**: navegación inferior en móvil, superior en escritorio

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| UI | React 19 + Tailwind CSS 4 |
| Base de datos | Supabase (PostgreSQL + Row Level Security) |
| Autenticación | Supabase Auth |
| Storage | Supabase Storage (imágenes de preguntas) |
| Gráficos | Recharts |
| Lenguaje | TypeScript 5 |

## Requisitos

- Node.js 18+
- Una cuenta en [Supabase](https://supabase.com) con un proyecto creado

## Configuración

1. Clona el repositorio e instala dependencias:

```bash
git clone <repo-url>
cd quiz-app
npm install
```

2. Copia el archivo de entorno y rellena los valores:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
ADMIN_PASSWORD=<contraseña-para-el-panel-admin>
```

Las claves de Supabase están en **Project Settings → API** de tu proyecto.

3. Aplica el esquema de base de datos ejecutando `supabase/schema.sql` en el editor SQL de Supabase. Las migraciones en `supabase/migrations/` se pueden aplicar en orden si partes de un esquema anterior.

4. Arranca el servidor de desarrollo:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev    # Servidor de desarrollo
npm run build  # Build de producción
npm start      # Servidor de producción
npm run lint   # ESLint
```

## Estructura del proyecto

```
src/
├── app/
│   ├── page.tsx              # Inicio: selector de asignatura, temas y configuración
│   ├── test/                 # Ejecución del test y revisión de respuestas
│   ├── results/              # Resultados y guardado de sesión
│   ├── stats/                # Estadísticas e historial
│   ├── settings/             # Ajustes del usuario
│   └── admin/                # Panel de administración (protegido por contraseña)
│       ├── import/           # Importación de preguntas desde CSV
│       ├── questions/        # Listado, edición y eliminación de preguntas
│       └── subjects/         # Gestión de asignaturas y temas
├── components/
│   └── Navbar.tsx
└── lib/
    ├── supabase/             # Clientes Supabase (admin, client, server, storage)
    └── types.ts              # Tipos TypeScript globales
supabase/
├── schema.sql
└── migrations/
```

## Importación de preguntas desde CSV

El CSV debe tener las siguientes columnas (con cabecera o sin ella), separadas por `,` o `;`:

```
subject, topic, statement, option1, option2, option3, option4, correctIndex
```

- `correctIndex` es el número de la opción correcta (1–4).
- Al subir el archivo, la app muestra una vista previa indicando cuántas preguntas son nuevas, cuántas son duplicados exactos (se omiten) y cuántas tienen conflicto (mismo enunciado, opciones distintas).

## Flujo básico de uso

1. En la página de inicio, selecciona una asignatura, los temas que quieres repasar, el número de preguntas y el temporizador.
2. Elige entre **Modo personal** (guarda el resultado) o **Modo invitado**.
3. Responde las preguntas y finaliza el test.
4. Consulta tu puntuación y revisa las respuestas.
5. En `/stats` puedes ver tu evolución a lo largo del tiempo.

## Panel de administración

Accede a `/admin` e introduce la contraseña configurada en `ADMIN_PASSWORD`. Desde ahí puedes:

- Crear preguntas una a una con enunciado, imagen, explicación y opciones.
- Importar un lote de preguntas desde un CSV.
- Editar o eliminar preguntas existentes.
- Crear y gestionar asignaturas y temas.
