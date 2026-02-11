using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);

// --- SERVICIOS ---
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Configuración de CORS: Permite que Angular (4200) hable con C# (5069)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular",
        policy => policy.WithOrigins("http://localhost:4200")
                        .AllowAnyMethod()
                        .AllowAnyHeader());
});

var app = builder.Build();

// --- MIDDLEWARE (EL ORDEN IMPORTA) ---

if (app.Environment.IsDevelopment()) 
{ 
    app.MapOpenApi(); 
}

// 1. Primero el CORS para dar permiso
app.UseCors("AllowAngular");

// 2. Quitamos UseHttpsRedirection para evitar el error SSL en local
// app.UseHttpsRedirection(); 

app.UseAuthorization();
app.MapControllers();

app.Run();