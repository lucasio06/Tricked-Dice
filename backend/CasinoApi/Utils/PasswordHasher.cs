using System.Security.Cryptography;
using System.Text;

namespace CasinoApi.Utils
{
    public static class PasswordHasher
    {
        // Este método recibe la contraseña normal (ej: "patata") y devuelve el hash (ej: "5A1F...")
        public static string HashPassword(string password)
        {
            // Usamos SHA256 como pide el requisito de seguridad
            using (var sha256 = SHA256.Create())
            {
                // 1. Convertimos la contraseña en bytes
                var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));

                // 2. Convertimos los bytes en un string hexadecimal bonito
                var builder = new StringBuilder();
                for (int i = 0; i < bytes.Length; i++)
                {
                    builder.Append(bytes[i].ToString("x2"));
                }
                
                return builder.ToString();
            }
        }

        // Método extra para comprobar si una contraseña es correcta
        public static bool VerifyPassword(string passwordIngresada, string hashGuardado)
        {
            // Volvemos a hashear lo que escribe el usuario
            string hashIngresado = HashPassword(passwordIngresada);

            // Comparamos si el hash nuevo es idéntico al que tenemos en la base de datos
            return hashIngresado == hashGuardado;
        }
    }
}