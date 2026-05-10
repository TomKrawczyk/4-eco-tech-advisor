const sourceModules = import.meta.glob("../**/*.{js,jsx,ts,tsx,json,css,html}", {
  query: "?raw",
  import: "default",
  eager: true,
});

const normalizePath = (path) => path.replace(/^\.\.\//, "");

const toFiles = (modules) =>
  Object.entries(modules).map(([path, content]) => ({
    path: normalizePath(path),
    content: String(content || ""),
  }));

export function getBackendSourceFiles() {
  const files = toFiles(sourceModules).filter((file) => file.path !== "lib/backendExportSources.js");

  const manifest = {
    generated_at: new Date().toISOString(),
    total_files: files.length,
    total_characters: files.reduce((sum, file) => sum + file.content.length, 0),
    folders: {
      functions: files.filter((file) => file.path.startsWith("functions/")).length,
      entities: files.filter((file) => file.path.startsWith("entities/")).length,
      agents: files.filter((file) => file.path.startsWith("agents/")).length,
      pages: files.filter((file) => file.path.startsWith("pages/")).length,
      components: files.filter((file) => file.path.startsWith("components/")).length,
      api: files.filter((file) => file.path.startsWith("api/")).length,
      lib: files.filter((file) => file.path.startsWith("lib/")).length,
      root_config: files.filter((file) => ["App.jsx", "main.jsx", "index.css", "pages.config.js"].includes(file.path)).length,
    },
    migration_notice: "To jest kompletny eksport kodu aplikacji dostępnego w projekcie Base44. Nie zawiera wewnętrznego kodu platformy Base44, serwerów Base44, bazy danych jako silnika, auth providera ani implementacji pakietu @base44/sdk — te elementy są usługą platformową. Zawiera natomiast kod funkcji, encji, stron, komponentów i konfiguracji aplikacji oraz osobno dane/schematy pobrane przez funkcję eksportu.",
    missing_from_export_by_design: [
      "Sekrety środowiskowe: MAIN_ADMIN_EMAIL, BREVO_API_KEY, GOOGLE_SHEETS_SPREADSHEET_ID",
      "Wewnętrzna implementacja @base44/sdk i infrastruktura Base44",
      "Wewnętrzny backend logowania/auth Base44",
      "Silnik bazy danych Base44 — eksportowane są schematy i rekordy, nie sama platforma bazy"
    ],
    files: files.map((file) => ({ path: file.path, characters: file.content.length })),
  };

  return [
    ...files,
    {
      path: "FULL_MIGRATION_NOTICE.txt",
      content:
        "Paczka zawiera wszystkie pliki źródłowe aplikacji dostępne w projekcie Base44: funkcje backendowe, encje, komponenty, strony i konfigurację. Nie może zawierać wewnętrznego kodu platformy Base44 ani implementacji @base44/sdk, bo to nie jest część kodu projektu — to usługa/platforma. Do migracji na własny serwer trzeba zastąpić Base44 SDK własnym backendem, auth, bazą danych i storage, używając dołączonych funkcji, schematów i danych jako punktu wyjścia. Sekrety środowiskowe trzeba ustawić ręcznie.",
    },
    {
      path: "source-manifest.json",
      content: JSON.stringify(manifest, null, 2),
    },
  ];
}