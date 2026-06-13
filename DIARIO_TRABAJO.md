# Diario de Trabajo - Proyecto Tricked Dice

## Datos del Proyecto

**Ciclo Formativo:** ASIR (Administración de Sistemas Informáticos en Red)
**Curso Académico:** 2025-2026
**Proyecto:** Tricked Dice (Plataforma de juegos con autenticación, multijugador y pagos)

---

# FASE 1: Análisis, inicialización y configuración (Febrero - 14/04/2026)

Durante esta fase se realiza la creación inicial del repositorio, estructura del proyecto y configuración base del entorno de desarrollo.

| Fecha      | Integrante     | Actividad                                                                                      |
| ---------- | -------------- | ---------------------------------------------------------------------------------------------- |
| 11/02/2026 | Lucas Moreno   | Creación del repositorio, estructura inicial del backend y configuración general del proyecto. |
| 11/02/2026 | Rubén Segovia  | Redacción inicial del README y documentación básica del proyecto.                              |
| 12/02/2026 | Samuel Sánchez | Configuración del control de versiones, .gitignore y securización de archivos sensibles.       |
| 12/02/2026 | Raúl Díaz      | Apoyo en documentación y estructura inicial del proyecto.                                      |
| 14/04/2026 | Rubén Segovia  | Validación de formularios (DNI) en frontend y backend.                                         |
| 14/04/2026 | Samuel Sánchez | Implementación de sistema de notificaciones base en la interfaz.                               |

---

# FASE 2: Autenticación y funcionalidades base (15/04/2026 - 30/04/2026)

Se desarrolla el sistema de autenticación, estructura principal de la aplicación y primeras funcionalidades del sistema.

| Fecha      | Integrante     | Actividad                                                                          |
| ---------- | -------------- | ---------------------------------------------------------------------------------- |
| 15/04/2026 | Lucas Moreno   | Implementación de autenticación JWT, interceptores HTTP y estructura de seguridad. |
| 20/04/2026 | Rubén Segovia  | Sistema de recarga de saldo de usuario.                                            |
| 21/04/2026 | Samuel Sánchez | Desarrollo inicial del sistema de ruleta y gestión de errores en UI.               |
| 21/04/2026 | Raúl Díaz      | Implementación inicial del Video Poker y navegación del lobby.                     |
| 25/04/2026 | Rubén Segovia  | Desarrollo del panel de administración y gestión de usuarios.                      |
| 27/04/2026 | Rubén Segovia  | Diseño y desarrollo de la página principal pública responsive.                     |
| 28/04/2026 | Samuel Sánchez | Mejora de animaciones y experiencia de usuario en juegos.                          |

---

# FASE 3: Multijugador, pagos y comunicación en tiempo real (Mayo 2026)

Se implementan funcionalidades avanzadas como multijugador, comunicación en tiempo real y sistemas de pago.

| Fecha      | Integrante     | Actividad                                                                     |
| ---------- | -------------- | ----------------------------------------------------------------------------- |
| 10/05/2026 | Lucas Moreno   | Migración a SignalR para comunicación en tiempo real (lobby, juegos y salas). |
| 12/05/2026 | Lucas Moreno   | Sistema de apuestas múltiples en ruleta.                                      |
| 12/05/2026 | Samuel Sánchez | Implementación de elementos interactivos en la ruleta.                        |
| 16/05/2026 | Lucas Moreno   | Desarrollo completo de la ruleta multijugador.                                |
| 25/05/2026 | Rubén Segovia  | Integración de sistema de pagos con Stripe Checkout.                          |
| 25/05/2026 | Samuel Sánchez | Estabilización del sistema multijugador y sincronización de estado.           |
| 29/05/2026 | Rubén Segovia  | Integración de autenticación con Google OAuth.                                |
| 31/05/2026 | Lucas Moreno   | Refactorización general del sistema de juegos y mejoras de arquitectura.      |

---

# FASE 4: Infraestructura, despliegue y cierre del proyecto (Junio 2026)

Se realizan tareas finales de optimización, despliegue y securización del sistema.

| Fecha      | Integrante     | Actividad                                                                |
| ---------- | -------------- | ------------------------------------------------------------------------ |
| 01/06/2026 | Lucas Moreno   | Dockerización del proyecto y configuración de docker-compose.            |
| 01/06/2026 | Lucas Moreno   | Implementación de patrón repositorio y mejora de arquitectura backend.   |
| 01/06/2026 | Lucas Moreno   | Scripts de backup de base de datos y automatización.                     |
| 01/06/2026 | Samuel Sánchez | Corrección de errores en lobby y optimización de rendimiento.            |
| 01/06/2026 | Lucas Moreno   | Implementación de middleware global de errores y mejoras de seguridad.   |
| 01/06/2026 | Lucas Moreno   | Eliminación de credenciales sensibles y configuración de entorno seguro. |
| 10/06/2026 | Rubén Segovia  | Despliegue del backend en MonsterASP para enlazar la API con el frontend en Vercel. |
| 10/06/2026 | Rubén Segovia  | Gestión perimetral en producción, tramitación e instalación del certificado SSL/TLS con Let's Encrypt para habilitar HTTPS (Puerto 443). |
| 11/06/2026 | Lucas Moreno   | Resolución de incidencias de red e integración de políticas de origen CORS en `Program.cs` para enlazar de forma segura la API con el dominio de Vercel. |
| 13/06/2026 | Rubén Segovia  | Cierre, revisión cruzada de la memoria técnica final del proyecto y preparación del material audiovisual para la defensa. |
---

# Nota final

El desarrollo del proyecto ha sido iterativo, con integración continua mediante Git, dividiendo las tareas por módulos funcionales (backend, frontend, multijugador, pagos e infraestructura), lo que ha permitido una evolución progresiva del sistema hasta su versión final.
