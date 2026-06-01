FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["TrickedDice.Api.csproj", "./"]
RUN dotnet restore "TrickedDice.Api.csproj"

COPY . .
WORKDIR "/src/"
RUN dotnet build "TrickedDice.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "TrickedDice.Api.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
EXPOSE 8080
EXPOSE 8081
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "TrickedDice.Api.dll"]