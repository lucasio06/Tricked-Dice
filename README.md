🎲 Tricked Dice - Proyecto Intermodular ASIR 2025-2026
1. Título del Proyecto

Tricked Dice: Plataforma de juegos de casino multijugador en tiempo real con arquitectura cliente-servidor.

2. 👨‍💻 Autores
Lucas Moreno Navas
Samuel Iván Sánchez Muñoz
Raúl Díaz Martín
Rubén Manuel Segovia Cantero
3. 📌 Descripción del Proyecto

Tricked Dice es una plataforma de casino online multijugador desarrollada como proyecto intermodular del ciclo ASIR.

El sistema permite el registro de usuarios, autenticación segura mediante JWT, gestión de saldo virtual y participación en juegos multijugador en tiempo real como Ruleta, Blackjack y Póker, utilizando comunicación basada en WebSockets mediante SignalR.

Además, el proyecto integra:

Sistema de pagos con Stripe (recargas de saldo virtual)
Autenticación externa mediante Google OAuth
Arquitectura cliente-servidor desacoplada
Sistema de roles y control de acceso
Auditoría de transacciones y trazabilidad de operaciones
Automatización de copias de seguridad de base de datos
Despliegue mediante contenedores Docker

El proyecto abarca tanto el desarrollo de software como la administración de sistemas, incluyendo despliegue, seguridad, infraestructura y mantenimiento.

4. 🛠️ Tecnologías utilizadas
Backend
C# (.NET 10 ASP.NET Core Web API)
SQL Server (procedimientos, triggers y transacciones)
SignalR (comunicación en tiempo real)
JWT + BCrypt (seguridad)
Stripe API (pagos)
Frontend
Angular (TypeScript)
SCSS / CSS
Infraestructura
Docker / Docker Compose
Proxmox (entorno de despliegue)
Scripts Bash (backups y automatización)
5. 🗄️ Base de Datos

📌 Diagrama entidad-relación incluido en la memoria del proyecto.

6. ⚙️ Ejecución local
Backend
cd TrickedDice.Server/TrickedDice.Api
dotnet run
Frontend
cd TrickedDice.Client/TrickedDice-Web
pnpm install
pnpm start
Docker
cd TrickedDice.Server
docker-compose up -d
7. 📸 Capturas de pantalla

Incluidas en la memoria del proyecto (login, lobby, juegos, panel de administración).

8. 🌐 Despliegue

Entorno de producción desplegado en infraestructura virtualizada (Proxmox + contenedores Docker).

9. 🎥 Vídeo de demostración

Disponible en plataforma de vídeo (YouTube/Vimeo).

10. 📚 Documentación y referencias
Documentación oficial de .NET
Angular Docs
Stripe API
SignalR
SQL Server
📄 Licencia

Proyecto desarrollado con fines académicos en el marco del ciclo ASIR.
Se permite su uso con fines educativos citando a los autores.

© 2026 Tricked Dice.
