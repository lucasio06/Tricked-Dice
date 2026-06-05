# 🎲 Tricked Dice - Proyecto Intermodular ASIR 2025-2026

## 1. Título del Proyecto
**Tricked Dice:** Plataforma Multijugador de Juegos de Casino en Tiempo Real.

## 2. 👨‍💻 Autores del proyecto
- Lucas Moreno Navas  
- Samuel Iván Sánchez Muñoz  
- Raúl Díaz Martín  
- Rubén Manuel Segovia Cantero  

## 3. 📌 Descripción
Tricked Dice es una plataforma de casino online multijugador desarrollada bajo una arquitectura cliente-servidor. Permite a los usuarios registrarse, recargar saldo virtual mediante una pasarela de pagos simulada y participar en salas de juego en tiempo real (Póker, Blackjack y Ruleta) interactuando con otros jugadores.

El proyecto incluye:
- Auditoría de transacciones  
- Copias de seguridad automatizadas  
- Despliegue mediante contenedores  
- Arquitectura completa de sistema distribuido  

El objetivo es cubrir el ciclo completo de desarrollo y administración de sistemas en un entorno realista.

---

## 4. 🛠️ Tecnologías utilizadas

### Backend
- **Lenguaje:** C#
- **Framework:** .NET 10.0 (ASP.NET Core Web API)
- **Base de datos:** SQL Server (Triggers y transacciones)
- **Tiempo Real:** SignalR (WebSockets)
- **Seguridad:** JWT, BCrypt, Stripe API

### Frontend
- **Lenguaje:** TypeScript
- **Framework:** Angular
- **Estilos:** CSS / SCSS

### Infraestructura y despliegue
- **Plataforma:** MonsterASP / Proxmox
- **Contenedores:** Docker, Docker Compose
- **Automatización:** Scripts Bash (backups)

---

## 5. 🗄️ Esquema de Base de Datos
*(Pendiente: añadir diagrama E/R en la memoria del proyecto)*

---

## 6. ⚙️ Ejecución local (guía de instalación)

El proyecto puede ejecutarse en modo desarrollo o mediante contenedores.

### 🟢 Opción A: Desarrollo local

**Backend**
```bash
cd TrickedDice.Server/TrickedDice.Api
dotnet run
```

**Frontend**
```bash
cd TrickedDice.Client/TrickedDice-Web
pnpm install
pnpm start #o ng serve
```

### 🐳 Opción B: Docker
```bash
cd TrickedDice.Server
docker-compose up -d
```

---

## 7. 📸 Tutorial de uso
*Pendiente: añadir capturas de la interfaz.*

---

## 8. 🌐 URL de producción
Despliegue en entorno real: *URL pendiente de inserción*

---

## 9. 🎥 Vídeo de presentación
*Pendiente: enlace a YouTube o Vimeo.*

---

## 10. 📚 Enlace al anteproyecto
*Pendiente: documento del anteproyecto.*

---

## 11. 📖 Bibliografía
- **Documentación oficial de Microsoft .NET**
- **Documentación oficial de Angular**
- **Documentación de Stripe API**
- **Documentación de SignalR**
- **SQL Server Documentation**

---

## 📄 Licencia
Este proyecto ha sido desarrollado con fines académicos en el marco del ciclo formativo ASIR.

Se permite su uso exclusivamente con fines educativos, citando a los autores.

© 2026 Tricked Dice. Todos los derechos reservados.
