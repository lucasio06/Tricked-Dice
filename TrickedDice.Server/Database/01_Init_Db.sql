CREATE TABLE AUDITORIA_SALDO (
    IdAuditoria INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NOT NULL,
    SaldoAnterior DECIMAL(18,2) NOT NULL,
    SaldoNuevo DECIMAL(18,2) NOT NULL,
    FechaModificacion DATETIME DEFAULT GETDATE(),
    UsuarioModificador VARCHAR(100)
);
GO

CREATE TRIGGER TR_Auditar_Cambio_Saldo
ON USUARIO
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF UPDATE(SALDO)
    BEGIN
        INSERT INTO AUDITORIA_SALDO (IdUsuario, SaldoAnterior, SaldoNuevo, UsuarioModificador)
        SELECT 
            i.ID_USUARIO,
            d.SALDO,
            i.SALDO,
            SYSTEM_USER
        FROM inserted i
        INNER JOIN deleted d ON i.ID_USUARIO = d.ID_USUARIO
        WHERE i.SALDO <> d.SALDO;
    END
END;
GO