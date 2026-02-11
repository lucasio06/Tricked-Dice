using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);

// 1. Configuración de CORS (Permisos para el Frontend)
builder.Services.AddCors(options =>
{
    options.AddPolicy("PermitirTodo", policy => 
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader());
});

var app = builder.Build();
app.UseCors("PermitirTodo");

// --- ENDPOINT DE PRUEBA SQL SERVER ---
app.MapGet("/", async () =>
{
    try
    {
        var builderConexion = new SqlConnectionStringBuilder();
        
        // Datos públicos del servidor (Seguros para subir a GitHub)
        builderConexion.DataSource = "db41007.public.databaseasp.net"; 
        builderConexion.InitialCatalog = "db41007";           
        builderConexion.UserID = "db41007";                   

        // 2. SEGURIDAD: Leemos la contraseña de los User Secrets
        // Esto busca en tu ordenador, NO en el código escrito
        var passwordSecreto = builder.Configuration["DbPassword"];

        if (string.IsNullOrEmpty(passwordSecreto)) 
        {
             // Este error saltará si tus compañeros no configuran el secreto en su PC
             return Results.Problem("❌ ERROR DE SEGURIDAD: No se encontró la contraseña. Ejecuta 'dotnet user-secrets set \"DbPassword\" \"LA_CONTRASEÑA\"' en la terminal.");
        }

        builderConexion.Password = passwordSecreto;

        // Configuraciones obligatorias para MonsterASP
        builderConexion.TrustServerCertificate = true; 
        builderConexion.Encrypt = true;
        builderConexion.ConnectTimeout = 30;

        string connectionString = builderConexion.ToString();

        // 3. Intento de Conexión
        using (var conexion = new SqlConnection(connectionString))
        {
            await conexion.OpenAsync();
            
            var comando = new SqlCommand("SELECT @@VERSION", conexion);
            var version = await comando.ExecuteScalarAsync();

            return Results.Ok($"✅ ¡ÉXITO TOTAL! Conectado de forma SEGURA a SQL Server.\nVersión: {version}");
        }
    }
    catch (Exception ex)
    {
        return Results.Problem($"❌ ERROR TÉCNICO: {ex.Message}");
    }
});

app.Run();