using BCrypt.Net;

public class SecurityHelper
{
    // Hashear la contraseña en la base de datos para cuando se cree un usuario.
    public static string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password);
    }

    // Compara la contraseña del usuario con el hash de la base de datos cuando intenta un login.
    public static bool VerifyPassword(string password, string hashedPassword)
    {
        return BCrypt.Net.BCrypt.Verify(password, hashedPassword);
    }
}