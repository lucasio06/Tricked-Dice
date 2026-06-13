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
<img width="1386" height="1163" alt="image" src="https://github.com/user-attachments/assets/bce322e0-bca9-4277-8cb3-33ac4ec438dc" />


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
**Página de inicio**
<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/7a504df2-4785-4457-a837-d4a3b7c12cc4" />
**Inicio de sesión**
<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/6e6196a8-6664-4245-9a38-89ed36550aa0" />
**Registro**
<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/63588221-f52c-4903-86c1-5b2b0f84681c" />
**Recargar saldo**
<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/a1913fe5-55bf-44b0-ab2d-f59594645df4" />
**Pasarela de pago de Stripe**
<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/67feaf20-5737-4ff3-a7d0-9d69531e788a" />
**Pago exitoso**
<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/cb2fd4fa-7d92-48b7-b67f-8ef85ea3b574" />
**Lobby principal**
<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/0ab84523-9349-407d-9580-ed7cbd71c0dd" />
**Sala pública**
<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/4504bca7-4ae2-447b-922f-799fa6822e01" />
**Ruleta**
<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/b8bfddd5-2095-4cf4-bf59-2b1307b63dd4" />
**Blackjack**
<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/9b70ee90-4dd3-45c6-adb3-6836ef39c263" />
**Poker**
<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/e9484623-24d5-4a98-8efe-2873fadcc077" />
**Mi perfil**
<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/d603b719-8133-49cf-985a-4d44a814b9fa" />
**Mis movimientos**
<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/2f497959-8c08-441d-916e-8115f5c3863e" />
**Sobre nosotros**
<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/f37af29c-ef7e-448a-a574-61a32c8506f3" />
**Política de privacidad**
<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/22c8a94e-94e5-4792-a499-017eae8126f3" />
**Soporte**
<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/9b00921e-3298-4d76-8022-db2e935df155" />
**Panel de administración**
<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/37cc316d-e4ec-4f89-94b8-509ad64d6a4c" />

---

## 8. 🌐 URL de producción
Despliegue en entorno real: https://tricked-dice.vercel.app/

---

## 9. 🎥 Vídeo de presentación
https://youtu.be/vt0nBkNa14A 

---

## 10. 📖 Bibliografía
- **Microsoft Learn. ASP.NET Core Hosting Bundle & Production Deployments.** https://learn.microsoft.com/en-gb/aspnet/core/host-and-deploy/?view=aspnetcore-10.0 
- **Vercel Docs. Deployment and Architecture.** https://vercel.com/docs/getting-started-with-vercel 
- **Docker Documentation. Docker Compose Specification & Multi-Container Networks Guide.** https://docs.docker.com/reference/compose-file/ 
- **Proxmox Server Solutions. Proxmox VE (Virtual Environment) Official Architecture Documentation.** https://pve.proxmox.com/pve-docs/ 
- **The Linux Documentation Project. Advanced Bash-Scripting Guide & Shell Automation.** https://tldp.org/LDP/abs/html/
- **Microsoft Learn. SQL Server 2022 Technical Product Documentation.** https://learn.microsoft.com/en-gb/sql/sql-server/?view=sql-server-ver16
- **Dapper .NET. Official Micro-ORM Mapping & High-Performance Data Access.** https://github.com/DapperLib/Dapper
- **Microsoft Learn. Microsoft.Data.SqlClient Native Driver Architecture for .NET.** https://learn.microsoft.com/en-gb/sql/connect/ado-net/overview-sqlclient-driver?view=sql-server-ver16
- **Microsoft Learn. Real-Time Sockets Communication with ASP.NET Core SignalR Hubs.** https://learn.microsoft.com/en-gb/aspnet/core/signalr/introduction?view=aspnetcore-10.0
- **Stripe API Reference. Developer Documentation, Checkout Sessions, and Webhook Event Handling.** https://docs.stripe.com/api
- **Google Developers Identity. Backend OpenID Connect (OIDC) Token Validation & Federated Login Guide.** https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- **Angular Docs. Developer Guide: Angular Server-Side Rendering (SSR) & Reactive Architecture.** https://v21.angular.dev/guide/ssr
- **Internet Engineering Task Force (IETF). RFC 7519. JSON Web Token (JWT) Standard Specification.** https://datatracker.ietf.org/doc/html/rfc7519
- **Microsoft Learn. Safe Storage of App Secrets in Development in ASP.NET Core (.NET User Secrets).** https://learn.microsoft.com/en-gb/aspnet/core/security/app-secrets?view=aspnetcore-10.0&tabs=windows%2Cpowershell
- **Microsoft Learn. Cross-Origin Resource Sharing (CORS) Security Policies in .NET Web APIs.** https://learn.microsoft.com/en-gb/aspnet/core/security/cors?view=aspnetcore-10.0
- **Vitest Dev. Vitest Testing Guide: Fast Unit Test Runner & Mocking Reference.** https://vitest.dev/guide/ 
---

## 📄 Licencia
Este proyecto ha sido desarrollado con fines académicos en el marco del ciclo formativo ASIR.

Se permite su uso exclusivamente con fines educativos, citando a los autores.

© 2026 Tricked Dice. Todos los derechos reservados.
