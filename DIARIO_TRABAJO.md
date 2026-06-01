# Diario de Trabajo - Proyecto Tricked Dice

**Autores:**
* **Lucas Moreno Navas** (Líder de Proyecto / Infraestructura / DevOps)
* **Samuel Iván Sánchez Muñoz** (Backend / Concurrencia Multihilo / UI)
* **Raúl Díaz Martín** (Frontend / Maquetación / Páginas Estáticas)
* **Rubén Manuel Segovia Cantero** (Base de Datos / Autenticación / Frontend)

**Ciclo Formativo:** ASIR (Administración de Sistemas Informáticos en Red)
**Curso Académico:** 2025-2026

---

## FASE 1: Inicialización y Setup del Proyecto (Febrero)

| Fecha | Miembro | Horas | Tarea Realizada | Módulos Implicados |
| :--- | :--- | :---: | :--- | :--- |
| 11/02/2026 | Lucas Moreno | 2 | Creación del repositorio, estructura base y primer commit. | SRI |
| 11/02/2026 | Rubén Manuel | 1 | Redacción de datos básicos en el README.md. | Generales |
| 12/02/2026 | Samuel Iván | 2 | Configuración de `.gitignore`, iconos y securización de `appsettings.json`. | SRI, Seguridad |
| 12/02/2026 | Raúl Díaz | 1 | Actualización de documentación en README. | Generales |

*(Nota: Pausa en el desarrollo durante marzo y principios de abril por coincidencia con el periodo de prácticas en empresa, Semana Blanca y festivos de Semana Santa).*

## FASE 2: Autenticación, Base de Datos y Maquetación Base (Mediados de Abril)

| Fecha | Miembro | Horas | Tarea Realizada | Módulos Implicados |
| :--- | :--- | :---: | :--- | :--- |
| 14/04/2026 | Rubén Manuel | 4 | Lógica de validación de DNI (Front/Back) y estilos del login. | IAW, LMGSI |
| 14/04/2026 | Samuel Iván | 2 | Sistema de notificaciones / Toasts en la UI. | LMGSI |
| 15/04/2026 | Lucas Moreno | 5 | Implementación de JWT, User Secrets, interceptores HTTP y Auth Service. | Seguridad, IAW |
| 20/04/2026 | Lucas Moreno | 3 | Refactorización de Auth, Guards en Angular y transacciones base. | Seguridad, LMGSI |
| 20/04/2026 | Rubén Manuel | 3 | Desarrollo del esqueleto de recarga de saldo. | IAW |
| 21/04/2026 | Raúl Díaz | 4 | Rutas dinámicas del lobby, esqueleto de Video Poker y lógica inicial. | LMGSI, Programación |
| 21/04/2026 | Samuel Iván | 3 | Desarrollo minijuego ruleta inicial e interceptores de errores. | Programación, LMGSI |
| 21/04/2026 | Rubén Manuel | 2 | Implementación de Navbar persistente. | LMGSI |
| 23/04/2026 | Lucas Moreno | 3 | Centralización de API, tipado fuerte y mejoras de arquitectura. | IAW |
| 25/04/2026 | Rubén Manuel | 5 | Panel de Administración completo (estadísticas, baneo) y fixes de scroll/rutas. | IAW, LMGSI |
| 27/04/2026 | Rubén Manuel | 3 | Página Home pública responsive y redirección condicional. | LMGSI |
| 28/04/2026 | Samuel Iván | 5 | Animaciones avanzadas (flash, 3D), tooltips y sonidos sintetizados en Ruleta y Poker. | LMGSI |

## FASE 3: Multihilo, WebSockets (SignalR) y Pasarela de Pagos (Mayo)

| Fecha | Miembro | Horas | Tarea Realizada | Módulos Implicados |
| :--- | :--- | :---: | :--- | :--- |
| 04/05/2026 | Samuel Iván | 3 | Desarrollo de pruebas unitarias (28 tests) y control de sesiones. | Programación |
| 04/05/2026 | Lucas Moreno | 4 | Implementación de Blackjack con overlay de resultados y mejoras visuales. | Programación, LMGSI |
| 05/05/2026 | Rubén Manuel | 2 | Desarrollo del Footer y esqueleto de páginas legales. | LMGSI |
| 07/05/2026 | Raúl Díaz | 3 | Redacción y maquetación de Política de Privacidad, Sobre Nosotros y Soporte. | LMGSI, Digitalización |
| 10/05/2026 | Lucas Moreno | 6 | Migración masiva a SignalR: WebSockets para lobby, amigos y juegos. | SRI, Programación |
| 12/05/2026 | Lucas Moreno | 4 | Sistema multi-apuesta de ruleta y adaptación del backend. | IAW |
| 12/05/2026 | Samuel Iván | 3 | Desarrollo de hotspots invisibles en tapete de ruleta (caballo, calle, etc.). | LMGSI |
| 16/05/2026 | Lucas Moreno | 5 | Implementación completa de Ruleta Neon Luxury y salas multijugador. | Programación, LMGSI |
| 25/05/2026 | Rubén Manuel | 6 | Integración de Stripe Checkout (Recarga de fichas) y prevención de duplicados. | Seguridad, IAW |
| 25/05/2026 | Samuel Iván | 5 | Estabilización del Lobby multijugador, sistema de amigos y contadores sincronizados. | Programación |
| 27/05/2026 | Lucas Moreno | 5 | Refactorización de salas, control de empates en Blackjack y lógica de descarte en Poker. | Programación |
| 28/05/2026 | Samuel Iván | 4 | Gestión de turnos concurrente en Blackjack multijugador. | Programación |
| 29/05/2026 | Rubén Manuel | 4 | Integración de inicio de sesión con Google (OAuth) y validaciones estrictas. | Seguridad, IAW |
| 31/05/2026 | Lucas Moreno | 5 | Reconstrucción visual de Blackjack solitario, HUD de apuestas y MVC en backend. | IAW, LMGSI |

## FASE 4: Infraestructura, DevOps y Cierre Final (1 de Junio)

| Fecha | Miembro | Horas | Tarea Realizada | Módulos Implicados |
| :--- | :--- | :---: | :--- | :--- |
| 01/06/2026 | Samuel Iván | 3 | Corrección de fugas de memoria en el Lobby y fixes en premios de la ruleta. | Programación |
| 01/06/2026 | Lucas Moreno | 3 | Implementación del patrón Repositorio y Dapper en controladores (Auth/Admin). | IAW, GBD |
| 01/06/2026 | Lucas Moreno | 2 | Blindaje de concurrencia en juegos y middleware global de excepciones. | Programación |
| 01/06/2026 | Lucas Moreno | 2 | Script Bash de copias de seguridad (`backup_db.sh`) y retención. | ASO |
| 01/06/2026 | Lucas Moreno | 2 | Orquestación con `Dockerfile` y `docker-compose` para despliegue. | SRI |
| 01/06/2026 | Lucas Moreno | 2 | Script de esquema SQL (`01_Init_Db.sql`) y Trigger de auditoría. | ASGBD, GBD |
| 01/06/2026 | Lucas Moreno | 1 | Actualización final del `README.md` y configuración CORS. | Generales, Seguridad |

---

### Resumen de Horas por Integrante
* **Lucas Moreno Navas:** 52 horas
* **Rubén Manuel Segovia:** 33 horas
* **Samuel Iván Sánchez:** 34 horas
* **Raúl Díaz Martín:** 9 horas
* **TOTAL PROYECTO:** 128 horas