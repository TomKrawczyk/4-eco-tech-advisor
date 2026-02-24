import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, X, Image, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function ReportPhotoGallery({ reportId }) {
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const queryClient = useQueryClient();

  const { data: photos = [] } = useQuery({
    queryKey: ["reportPhotos", reportId],
    queryFn: () => base44.entities.VisitReportPhoto.filter({ report_id: reportId }),
    enabled: !!reportId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.VisitReportPhoto.delete(id),
    onSuccess: () => queryClient.invalidateQueries(["reportPhotos", reportId]),
  });

  const handleAddPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.VisitReportPhoto.create({
        report_id: reportId,
        photo_url: file_url,
        caption: file.name,
      });
    }
    queryClient.invalidateQueries(["reportPhotos", reportId]);
    setUploading(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Image className="w-4 h-4" /> Zdjęcia klienta
        {photos.length > 0 && <span className="text-gray-400 font-normal">({photos.length})</span>}
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer"
            onClick={() => setLightbox(photo.photo_url)}
          >
            <img src={photo.photo_url} alt={photo.caption || "Zdjęcie"} className="w-full h-full object-cover" />
            <button
              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(photo.id); }}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-green-400 hover:bg-green-50 flex flex-col items-center justify-center cursor-pointer transition-colors">
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotos} disabled={uploading} />
          {uploading ? (
            <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
          ) : (
            <>
              <Upload className="w-5 h-5 text-gray-400 mb-1" />
              <span className="text-xs text-gray-500">Dodaj zdjęcia</span>
            </>
          )}
        </label>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Powiększone" className="max-w-full max-h-full rounded-lg object-contain" />
          <button className="absolute top-4 right-4 text-white bg-black/40 rounded-full w-8 h-8 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}