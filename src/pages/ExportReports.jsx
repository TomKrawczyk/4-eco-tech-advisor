import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, ImageDown, Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import JSZip from "jszip";

export default function ExportReports() {
  const [excelLoading, setExcelLoading] = useState(false);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosProgress, setPhotosProgress] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleExcelExport = async () => {
    setExcelLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await base44.functions.invoke("exportReports", { type: "excel" });
      const { base64, filename, counts } = res.data;

      // Konwertuj base64 -> Blob -> pobierz
      const byteChars = atob(base64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess(`Pobrano Excel: ${counts.meeting} spotkania, ${counts.visit} wizyty, ${counts.service} serwisowe.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setExcelLoading(false);
    }
  };

  const handlePhotosExport = async () => {
    setPhotosLoading(true);
    setError(null);
    setSuccess(null);
    setPhotosProgress({ current: 0, total: 0, status: "Pobieranie listy zdjęć..." });

    try {
      // 1. Pobierz listę URL-i zdjęć
      const res = await base44.functions.invoke("exportReports", { type: "photos_list" });
      const photos = res.data?.photos || [];

      if (photos.length === 0) {
        setSuccess("Brak zdjęć do eksportu.");
        setPhotosLoading(false);
        setPhotosProgress(null);
        return;
      }

      setPhotosProgress({ current: 0, total: photos.length, status: "Pobieranie zdjęć..." });

      const zip = new JSZip();

      // 2. Pobierz zdjęcia i dodaj do ZIP
      for (let i = 0; i < photos.length; i++) {
        const { url, folder, filename } = photos[i];
        setPhotosProgress({ current: i + 1, total: photos.length, status: `Pobieranie: ${filename}` });

        try {
          const imgRes = await fetch(url);
          if (imgRes.ok) {
            const blob = await imgRes.blob();
            const ext = url.split(".").pop().split("?")[0].toLowerCase();
            const finalName = filename.replace(/\.jpg$/, `.${ext || "jpg"}`);
            zip.folder(folder).file(finalName, blob);
          }
        } catch (_) {
          // Pomiń błędne zdjęcia
        }
      }

      setPhotosProgress({ current: photos.length, total: photos.length, status: "Pakowanie do ZIP..." });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = zipUrl;
      a.download = `zdjecia_raporty_${new Date().toISOString().split("T")[0]}.zip`;
      a.click();
      URL.revokeObjectURL(zipUrl);

      setSuccess(`Pobrano ${photos.length} zdjęć w pliku ZIP!`);
    } catch (e) {
      setError(e.message);
    } finally {
      setPhotosLoading(false);
      setPhotosProgress(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Eksport raportów</h1>
        <p className="text-gray-500 text-sm mt-1">Pobierz wszystkie raporty (spotkania, wizyty, serwis) jako plik Excel lub spakowane zdjęcia.</p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="grid gap-4">
        {/* Excel Export */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              Eksport do Excel (.xlsx)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Generuje plik Excel z trzema arkuszami:
              <span className="flex flex-wrap gap-1 mt-2">
                <Badge variant="outline">Raporty po spotkaniu</Badge>
                <Badge variant="outline">Raporty wizytowe</Badge>
                <Badge variant="outline">Raporty serwisowe</Badge>
              </span>
              <span className="block mt-2 text-gray-500">Zawiera wszystkie dane + kolumny z URL-ami zdjęć.</span>
            </p>
            <Button
              onClick={handleExcelExport}
              disabled={excelLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {excelLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generowanie...</>
              ) : (
                <><Download className="w-4 h-4 mr-2" /> Pobierz Excel</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Photos Export */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageDown className="w-5 h-5 text-blue-600" />
              Eksport zdjęć (.zip)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Pobiera wszystkie zdjęcia z raportów i pakuje je do pliku ZIP.
              <span className="block mt-2 text-gray-500">Zdjęcia są posegregowane w folderach: <strong>spotkania/</strong>, <strong>wizyty/</strong>, <strong>serwis/</strong>.</span>
              <span className="block mt-1 text-yellow-600 text-xs">⚠ Może potrwać kilka minut przy dużej liczbie zdjęć.</span>
            </p>

            {photosProgress && (
              <div className="mb-4 bg-blue-50 rounded-lg p-3">
                <div className="flex justify-between text-xs text-blue-700 mb-1">
                  <span>{photosProgress.status}</span>
                  <span>{photosProgress.current} / {photosProgress.total}</span>
                </div>
                {photosProgress.total > 0 && (
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${(photosProgress.current / photosProgress.total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handlePhotosExport}
              disabled={photosLoading}
              variant="outline"
              className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              {photosLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Pobieranie zdjęć...</>
              ) : (
                <><Download className="w-4 h-4 mr-2" /> Pobierz ZIP ze zdjęciami</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}