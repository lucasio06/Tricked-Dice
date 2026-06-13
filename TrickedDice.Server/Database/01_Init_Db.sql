USE [db41007];
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