const functionModules = import.meta.glob("../functions/*", {
  query: "?raw",
  import: "default",
  eager: true,
});

const entityModules = import.meta.glob("../entities/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
});

const agentModules = import.meta.glob("../agents/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
});

const configModules = {
  ...import.meta.glob("../api/base44Client.js", { query: "?raw", import: "default", eager: true }),
  ...import.meta.glob("../pages.config.js", { query: "?raw", import: "default", eager: true }),
};

const normalizePath = (path) => path.replace(/^\.\.\//, "");

const toFiles = (modules) =>
  Object.entries(modules).map(([path, content]) => ({
    path: normalizePath(path),
    content: String(content || ""),
  }));

export function getBackendSourceFiles() {
  return [
    ...toFiles(functionModules),
    ...toFiles(entityModules),
    ...toFiles(agentModules),
    ...toFiles(configModules),
    {
      path: "backend-export-readme.txt",
      content:
        "Eksport zawiera pliki funkcji backendowych, schematy encji, konfigurację aplikacji oraz dane wyeksportowane przez zabezpieczoną funkcję backendową. Sekrety środowiskowe nie są eksportowane.",
    },
  ];
}