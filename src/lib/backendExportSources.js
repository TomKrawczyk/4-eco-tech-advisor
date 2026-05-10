const functionModules = import.meta.glob("../functions/**/*", {
  as: "raw",
  eager: true,
});

const entityModules = import.meta.glob("../entities/**/*.json", {
  as: "raw",
  eager: true,
});

const agentModules = import.meta.glob("../agents/**/*.json", {
  as: "raw",
  eager: true,
});

const backendConfigModules = {
  ...import.meta.glob("../api/base44Client.js", { as: "raw", eager: true }),
  ...import.meta.glob("../lib/app-params.js", { as: "raw", eager: true }),
  ...import.meta.glob("../lib/query-client.js", { as: "raw", eager: true }),
  ...import.meta.glob("../pages.config.js", { as: "raw", eager: true }),
};

const normalizePath = (path) => path.replace(/^\.\.\//, "");

const toFiles = (modules) =>
  Object.entries(modules).map(([path, content]) => ({
    path: normalizePath(path),
    content: String(content || ""),
  }));

export function getBackendSourceFiles() {
  const files = [
    ...toFiles(functionModules),
    ...toFiles(entityModules),
    ...toFiles(agentModules),
    ...toFiles(backendConfigModules),
  ];

  const manifest = {
    generated_at: new Date().toISOString(),
    total_files: files.length,
    total_characters: files.reduce((sum, file) => sum + file.content.length, 0),
    folders: {
      functions: files.filter((file) => file.path.startsWith("functions/")).length,
      entities: files.filter((file) => file.path.startsWith("entities/")).length,
      agents: files.filter((file) => file.path.startsWith("agents/")).length,
      config: files.filter((file) => file.path.startsWith("api/") || file.path.startsWith("lib/") || file.path === "pages.config.js").length,
    },
    files: files.map((file) => ({ path: file.path, characters: file.content.length })),
    note: "Sekrety środowiskowe nie są eksportowane ze względów bezpieczeństwa.",
  };

  return [
    ...files,
    {
      path: "backend-source-manifest.json",
      content: JSON.stringify(manifest, null, 2),
    },
    {
      path: "backend-export-readme.txt",
      content:
        "Ten katalog zawiera jawny eksport plików backendowych: functions/, entities/, agents/ oraz podstawową konfigurację SDK. Jeżeli plik ZIP ma podejrzanie mały rozmiar, sprawdź source/backend-source-manifest.json — powinien pokazywać liczbę i rozmiary dołączonych plików. Sekrety środowiskowe nie są eksportowane.",
    },
  ];
}