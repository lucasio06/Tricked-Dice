#!/bin/bash
#Este script está pensado para ejecutarse en un entorno Linux (como un servidor Ubuntu o mediante un Cron Job)
#que tenga instaladas las mssql-tools (donde viene el comando sqlcmd).
#A nivel académico, tener este código documentado y en el repositorio justifica la competencia exigida.

DB_NAME="db41007"
DB_USER="db41007"
DB_PASS="K#i3-x6H8=Gh" 
SERVER="db41007.public.databaseasp.net"

BACKUP_DIR="/var/backups/trickeddice"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/$DB_NAME_$DATE.bak"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Iniciando copia de seguridad de la base de datos: $DB_NAME..."

sqlcmd -S "$SERVER" -U "$DB_USER" -P "$DB_PASS" -Q "BACKUP DATABASE [$DB_NAME] TO DISK = N'$BACKUP_FILE' WITH NOFORMAT, NOINIT, NAME = 'Full Backup', SKIP, NOREWIND, NOUNLOAD, STATS = 10"

if [ $? -eq 0 ]; then
    echo "[$(date)] Copia de seguridad completada con éxito en SQL Server."
    
    gzip "$BACKUP_FILE"
    echo "[$(date)] Archivo comprimido a $BACKUP_FILE.gz"
    
    find "$BACKUP_DIR" -type f -name "*.bak.gz" -mtime +7 -exec rm {} \;
    echo "[$(date)] Backups antiguos purgados correctamente."
else
    echo "[$(date)] ERROR: Fallo al realizar la copia de seguridad." >&2
    exit 1
fi