using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);

// Servicios.
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Configuración de CORS: Aquí permitimos que Angular (puerto 4200) hable con C# (puerto 5069).
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular",
        policy => policy.WithOrigins("http://localhost:4200")
                        .AllowAnyMethod()
                        .AllowAnyHeader());
});

var app = builder.Build();

if (app.Environment.IsDevelopment()) 
{ 
    app.MapOpenApi(); 
}

// Usamos el CORS para dar permiso.
app.UseCors("AllowAngular");

app.UseAuthorization();
app.MapControllers();

app.Run();