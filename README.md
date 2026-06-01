# 🎲 Tricked Dice - Proyecto Intermodular ASIR 2025-2026

## 1. Título del Proyecto
**Tricked Dice:** Plataforma Multijugador de Juegos de Casino en Tiempo Real.

## 2. 👨‍💻 Autores del proyecto
* Lucas Moreno Navas
* Samuel Iván Sánchez Muñoz
* Raúl Díaz Martín
* Rubén Manuel Segovia Cantero

## 3. Descripción
Tricked Dice es una plataforma de casino online multijugador desarrollada bajo una arquitectura cliente-servidor. Permite a los usuarios registrarse, recargar saldo virtual mediante una pasarela de pagos simulada y participar en salas de juego en tiempo real (Póker, Blackjack y Ruleta) interactuando con otros jugadores. El proyecto incluye auditoría de transacciones, copias de seguridad automatizadas y despliegue orquestado mediante contenedores, cubriendo todo el ciclo de vida de administración de sistemas y desarrollo de software.

## 4. 🛠️ Tecnologías utilizadas

### Backend
* **Lenguaje:** C#  
* **Framework:** .NET 10.0 (ASP.NET Core Web API)   
* **Base de datos:** SQL Server (con Triggers y transacciones)
* **Tiempo Real:** SignalR (WebSockets)
* **Seguridad:** JWT, BCrypt, Stripe API

### Frontend
* **Lenguaje:** TypeScript  
* **Framework:** Angular  
* **Estilos:** CSS / SCSS

### Infraestructura y Despliegue
* **Plataforma:** MonsterASP, Proxmox
* **Contenedores:** Docker, Docker Compose
* **Mantenimiento:** Scripts Bash (Automatización de backups)

## 5. Esquema de Base de Datos
*(Pendiente: Subir imagen del diagrama E/R)*

## 6. Ejecución Local (Guía de Instalación)
El proyecto puede ejecutarse en modo desarrollo o mediante infraestructura de contenedores.

### Opción A: Modo Desarrollo (Local)
1. **Levantar el Backend:**
```bash
    cd TrickedDice.Server/TrickedDice.Api
    dotnet run
```

2. **Levantar el Frontend:**

```bash
    cd TrickedDice.Client/TrickedDice-Web
    pnpm install
    pnpm start  # (o ng serve)
```

### Opción B: Despliegue con Docker
Para desplegar la API y la base de datos de forma contenerizada:

```bash
    cd TrickedDice.Server
    docker-compose up -d
```

## 7. Tutorial de Uso
(Pendiente: Añadir capturas de pantalla de la interfaz)

## 8. URL de Producción
Despliegue (MonsterASP): [URL_AQUI]

## 9. Enlace a Vídeo de Presentación
(Pendiente: Enlace a YouTube/Vimeo)

## 10. Enlace al Anteproyecto
(Pendiente: Añadir enlace público al documento del anteproyecto)

## 11. Bibliografía
Documentación oficial de Microsoft .NET y Dapper.

Documentación oficial de Angular.

Documentación de Stripe API y SignalR.

## 📄 Licencia
Este proyecto está protegido por derechos de autor. No se permite su uso, copia, modificación, distribución ni creación de obras derivadas sin autorización expresa de los autores.

© 2026. Todos los derechos reservados.