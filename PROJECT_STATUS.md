# DYAD SAMURAI - MANUAL DE ESTADO Y REPORTE (v0.801)

Este documento detalla el estado actual del sistema tras la implementación de la versión 0.801.

## 1. RESUMEN EJECUTIVO

- **Estado del Sistema:** ✅ ONLINE
- **Versión:** 0.801-rc
- **Base de Datos:** ✅ Conectada (Supabase)
- **Integraciones:** ⚠️ Parcial (Requiere configuración en Make.com)

## 2. COMPONENTES INSTALADOS (✅)

Los siguientes módulos están completamente desarrollados, integrados con la base de datos y funcionales:

### A. Core & Auth
- [x] **Login:** Autenticación vía Supabase Auth.
- [x] **Gestión de Usuarios:** Creación y listado de usuarios (Tabla `profiles`).
- [x] **Logs de Auditoría:** Registro automático de acciones (Tabla `activity_logs`).

### B. Cerebro del Agente (Brain)
- [x] **Editor de Prompts:** 4 secciones de configuración (Sistema, Contexto, Corrección, Visión).
- [x] **Persistencia:** Los prompts se guardan en tabla `app_config`.
- [x] **Versionado:** Capacidad de ver historial y restaurar versiones anteriores del prompt.
- [x] **Test Runner:** Módulo para probar prompts conectando con Make (requiere configuración).

### C. Leads & Chat (Live)
- [x] **Tabla de Leads:** Visualización de clientes desde Kommo (Tabla `leads`).
- [x] **Visor de Chat:** Ventana deslizante para ver historial de mensajes en tiempo real (Tabla `conversaciones`).
- [x] **Simulación de Mensajes:** Capacidad de insertar mensajes "humanos" desde el panel.

### D. Herramientas Auxiliares
- [x] **Geoffrey:** Gestor de frases de cortesía y personalidad auxiliar.
- [x] **Media Manager:** Subida de imágenes/videos para que el agente los use.
- [x] **Base de Conocimiento:** Carga de PDFs/Links (Metadatos listos, vectorización pendiente).
- [x] **Configuración:** Gestión de API Keys y Webhooks.

## 3. LO QUE FALTA / REQUIERE CONFIGURACIÓN EXTERNA (⚠️)

Estos elementos dependen de servicios externos para funcionar al 100%:

1.  **Conexión Real con WhatsApp (Make.com):**
    *   *Estado:* El código tiene los webhooks listos (`src/utils/makeService.ts`).
    *   *Acción Requerida:* Debes configurar los Escenarios en Make.com y pegar las URLs en la página de Configuración del Panel.

2.  **Sincronización Kommo -> Supabase:**
    *   *Estado:* La tabla `leads` existe.
    *   *Acción Requerida:* Crear un webhook en Kommo que apunte a tu Edge Function (o Make) para insertar nuevos leads en Supabase cuando lleguen.

3.  **Vectorización de Documentos:**
    *   *Estado:* Los archivos se suben a Supabase Storage.
    *   *Falta:* No hay un proceso automático que lea el PDF, genere embeddings y los guarde para búsqueda semántica. Actualmente la búsqueda es por título/descripción.

## 4. TABLAS DE BASE DE DATOS (SCHEMA)

El sistema opera sobre las siguientes tablas en Supabase (Schema `public`):

| Tabla | Función | Estado |
| :--- | :--- | :--- |
| `profiles` | Datos extendidos de usuarios (roles) | ✅ |
| `leads` | Información de prospectos de Kommo | ✅ |
| `conversaciones` | Historial de chat (WhatsApp) | ✅ |
| `app_config` | Prompts, Keys y Configuración del sistema | ✅ |
| `activity_logs` | Auditoría de seguridad | ✅ |
| `frases_geoffrey` | Frases aleatorias del asistente | ✅ |
| `media_assets` | Catálogo de archivos multimedia | ✅ |
| `knowledge_documents` | Documentos de la base de conocimiento | ✅ |
| `versiones_prompts_aprendidas` | Historial de cambios del cerebro | ✅ |
| `errores_ia` | Registro de correcciones humanas (#CORREGIRIA) | ✅ |

---
*Reporte generado automáticamente por Dyad System v0.801*