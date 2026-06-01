USE [db41007];
GO

CREATE LOGIN [TrickedDice_App] WITH PASSWORD = 'StrongAppPassword123!';
CREATE USER [TrickedDice_App] FOR LOGIN [TrickedDice_App];
ALTER ROLE [db_datareader] ADD MEMBER [TrickedDice_App];
ALTER ROLE [db_datawriter] ADD MEMBER [TrickedDice_App];

CREATE LOGIN [TrickedDice_Auditor] WITH PASSWORD = 'AuditPassword456!';
CREATE USER [TrickedDice_Auditor] FOR LOGIN [TrickedDice_Auditor];
ALTER ROLE [db_datareader] ADD MEMBER [TrickedDice_Auditor];

GRANT EXECUTE TO [TrickedDice_App];
GO