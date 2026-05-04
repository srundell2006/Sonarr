# ── Stage 1: Build backend ────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build

WORKDIR /source

RUN apt-get update && apt-get install -y --no-install-recommends \
        git ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth=1 --branch v5-develop \
        https://github.com/srundell2006/Sonarr.git .

COPY NuGet.config ./NuGet.config

RUN dotnet publish src/NzbDrone.Console/Sonarr.Console.csproj \
        --configuration Release \
        --framework net10.0 \
        --self-contained false \
        --output /output \
        -p:TreatWarningsAsErrors=false \
        -p:NoWarn=NU1902%3BCS1591 && \
    # Mono.Posix.NETStandard is a runtime dep of Sonarr.Mono.dll but dotnet
    # publish does not automatically copy it because Sonarr.Mono is referenced
    # with ReferenceOutputAssembly=false.  Copy it explicitly from the NuGet
    # cache (restored as a dep of Sonarr.Mono.csproj).
    find /root/.nuget/packages/mono.posix.netstandard -name "Mono.Posix.NETStandard.dll" \
        | grep -v native | head -1 \
        | xargs -I{} cp {} /output/

# ── Stage 2: Build frontend ───────────────────────────────────────────────────
FROM node:20 AS frontend-build

WORKDIR /source

COPY --from=backend-build /source/package.json \
                          /source/yarn.lock \
                          ./

RUN yarn install --frozen-lockfile --network-timeout 120000

COPY --from=backend-build /source/frontend ./frontend
COPY --from=backend-build /source/Logo ./Logo
COPY --from=backend-build /source/tsconfig.json ./tsconfig.json

RUN NODE_OPTIONS=--max-old-space-size=4096 yarn build

# ── Stage 3: Runtime ──────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0

ENV PUID=1000 \
    PGID=1000 \
    TZ=Etc/UTC

COPY --from=backend-build /usr/share/zoneinfo /usr/share/zoneinfo

RUN groupadd -o -g 1000 abc \
    && useradd -o -u 1000 -g abc -s /bin/false -d /config abc

COPY --from=backend-build /output         /app/sonarr/bin
COPY --from=frontend-build /source/_output/UI /app/sonarr/bin/UI

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

VOLUME /config

EXPOSE 8989

ENTRYPOINT ["/entrypoint.sh"]
