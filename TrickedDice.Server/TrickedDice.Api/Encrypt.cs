using BCrypt.Net;

public class SecurityHelper
{
    // Para cuando el usuario se registra (RF01)
    public static string HashPassword(string password)
    {
        // Genera un hash seguro de la contraseña
        return BCrypt.Net.BCrypt.HashPassword(password);
    }

    // Para cuando el usuario intenta hacer Login (RF02)
    public static bool VerifyPassword(string password, string hashedPassword)
    {
        // Compara la contraseña metida con el hash de la DB
        return BCrypt.Net.BCrypt.Verify(password, hashedPassword);
    }
}