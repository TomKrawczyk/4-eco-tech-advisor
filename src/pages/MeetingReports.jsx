import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Calendar, Phone, MapPin, User, Clock, CheckCircle2, XCircle, ChevronRight, ArrowLeft, Trash2, Upload, X, Image, Loader2, FileText } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

const statusConfig = {
  planned: { label: "Zaplanowane", color: "bg-blue-100 text-blue-700 border-blue-300", icon: Clock },
  completed: { label: "Zakończone", color: "bg-green-100 text-green-700 border-green-300", icon: CheckCircle2 },
  cancelled: { label: "Anulowane", color: "bg-red-100 text-red-700 border-red-300", icon: XCircle },
};

function PhotoGallery({ photos, onAdd, onRemove, uploading }) {
  return (
    <div>
      <Label className="mb-2 block">Zdjęcia</Label>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {(photos || []).map((url, i) => (
          <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
            <img src={url} alt={`Zdjęcie ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-green-400 hover:bg-green-50 flex flex-col items-center justify-center cursor-pointer transition-colors">
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onAdd}
            disabled={uploading}
          />
          {uploading ? (
            <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
          ) : (
            <>
              <Upload className="w-5 h-5 text-gray-400 mb-1" />
              <span className="text-xs text-gray-500">Dodaj</span>
            </>
          )}
        </label>
      </div>
    </div>
  );
}

function MeetingForm({ initialData, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initialData || {
    client_name: "",
    client_address: "",
    client_phone: "",
    meeting_date: new Date().toISOString().split("T")[0],
    meeting_time: "",
    description: "",
    next_steps: "",
    status: "planned",
    photos: [],
  });
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const handleAddPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingPhotos(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    setForm(prev => ({ ...prev, photos: [...(prev.photos || []), ...urls] }));
    setUploadingPhotos(false);
  };

  const handleRemovePhoto = (idx) => {
    setForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }));
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Imię i nazwisko klienta *</Label>
          <Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} required />
        </div>
        <div>
          <Label>Numer telefonu</Label>
          <Input value={form.client_phone} onChange={e => setForm({ ...form, client_phone: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <Label>Adres</Label>
          <Input value={form.client_address} onChange={e => setForm({ ...form, client_address: e.target.value })} />
        </div>
        <div>
          <Label>Data spotkania *</Label>
          <Input type="date" value={form.meeting_date} onChange={e => setForm({ ...form, meeting_date: e.target.value })} required />
        </div>
        <div>
          <Label>Godzina spotkania</Label>
          <Input type="time" value={form.meeting_time} onChange={e => setForm({ ...form, meeting_time: e.target.value })} />
        </div>
      </div>

      <div>
        <Label>Opis / Notatki ze spotkania</Label>
        <Textarea
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          rows={5}
          placeholder="Co omówiono na spotkaniu, ustalenia, uwagi klienta..."
        />
      </div>

      <div>
        <Label>Kolejne kroki / Plan działania</Label>
        <Textarea
          value={form.next_steps}
          onChange={e => setForm({ ...form, next_steps: e.target.value })}
          rows={3}
          placeholder="Co należy zrobić po spotkaniu..."
        />
      </div>

      <div>
        <Label>Status</Label>
        <div className="flex gap-2 mt-1">
          {Object.entries(statusConfig).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => setForm({ ...form, status: key })}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                form.status === key ? cfg.color : "border-gray-300 text-gray-600 hover:border-gray-400"
              }`}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      <PhotoGallery
        photos={form.photos}
        onAdd={handleAddPhotos}
        onRemove={handleRemovePhoto}
        uploading={uploadingPhotos}
      />

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving || uploadingPhotos} className="flex-1 bg-green-600 hover:bg-green-700">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Zapisz raport
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Anuluj</Button>
      </div>
    </form>
  );
}

function MeetingDetail({ report, onBack, onDelete, onEdit }) {
  const st = statusConfig[report.status || "planned"];
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Wróć</span>
        </button>
        <div className="flex gap-2">
          <Button onClick={onEdit} variant="outline" size="sm">Edytuj</Button>
          <Button onClick={onDelete} variant="ghost" size="sm" className="text-red-600 hover:bg-red-50">
            <Trash2 className="w-4 h-4 mr-1" /> Usuń
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">{report.client_name}</h2>
          <Badge variant="outline" className={`border ${st.color}`}>{st.label}</Badge>
        </div>
        <div className="space-y-2 text-sm text-gray-700">
          {report.client_address && (
            <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" />{report.client_address}</div>
          )}
          {report.client_phone && (
            <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" />{report.client_phone}</div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            {report.meeting_date ? new Date(report.meeting_date).toLocaleDateString("pl-PL") : "Brak daty"}
            {report.meeting_time && ` o ${report.meeting_time}`}
          </div>
          {report.author_name && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">{report.author_name}</span>
            </div>
          )}
        </div>
      </div>

      {report.description && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Notatki ze spotkania</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.description}</p>
        </div>
      )}

      {report.next_steps && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Kolejne kroki</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.next_steps}</p>
        </div>
      )}

      {report.photos?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Image className="w-4 h-4" /> Zdjęcia ({report.photos.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {report.photos.map((url, i) => (
              <div
                key={i}
                className="aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setLightboxPhoto(url)}
              >
                <img src={url} alt={`Zdjęcie ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {lightboxPhoto && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <img src={lightboxPhoto} alt="Powiększone zdjęcie" className="max-w-full max-h-full rounded-lg object-contain" />
          <button className="absolute top-4 right-4 text-white bg-black/40 rounded-full w-8 h-8 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function MeetingReports() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState("list"); // list | create | detail | edit
  const [selectedReport, setSelectedReport] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      const allowedUsers = await base44.entities.AllowedUser.list();
      const ua = allowedUsers.find(a => (a.data?.email || a.email) === user.email);
      if (ua) {
        user.role = ua.data?.role || ua.role;
        user.displayName = ua.data?.name || ua.name;
      }
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["meetingReports"],
    queryFn: () => base44.entities.MeetingReport.list("-created_date", 100),
    enabled: !!currentUser,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MeetingReport.create({
      ...data,
      author_name: currentUser?.displayName || currentUser?.full_name || "",
      author_email: currentUser?.email || "",
    }),
    onSuccess: (created) => {
      queryClient.invalidateQueries(["meetingReports"]);
      setSelectedReport(created);
      setView("detail");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MeetingReport.update(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries(["meetingReports"]);
      setSelectedReport(updated);
      setView("detail");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MeetingReport.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["meetingReports"]);
      setView("list");
      setSelectedReport(null);
    },
  });

  const filtered = reports.filter(r =>
    (r.client_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.client_address || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.client_phone || "").toLowerCase().includes(search.toLowerCase())
  );

  if (view === "create") {
    return (
      <div className="space-y-6">
        <PageHeader title="Nowy raport po spotkaniu" subtitle="Uzupełnij dane ze spotkania z klientem" />
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <MeetingForm
            onSave={(data) => createMutation.mutate(data)}
            onCancel={() => setView("list")}
            saving={createMutation.isPending}
          />
        </div>
      </div>
    );
  }

  if (view === "edit" && selectedReport) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edytuj raport" subtitle={selectedReport.client_name} />
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <MeetingForm
            initialData={selectedReport}
            onSave={(data) => updateMutation.mutate({ id: selectedReport.id, data })}
            onCancel={() => setView("detail")}
            saving={updateMutation.isPending}
          />
        </div>
      </div>
    );
  }

  if (view === "detail" && selectedReport) {
    return (
      <MeetingDetail
        report={selectedReport}
        onBack={() => { setView("list"); setSelectedReport(null); }}
        onDelete={() => deleteMutation.mutate(selectedReport.id)}
        onEdit={() => setView("edit")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Raporty po spotkaniach" subtitle="Dokumentacja spotkań z klientami" />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj klienta, adresu, telefonu..."
            className="pl-10 h-11"
          />
        </div>
        <Button onClick={() => setView("create")} className="bg-green-600 hover:bg-green-700 gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Nowy raport
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Wszystkie", count: reports.length, color: "text-gray-900" },
          { label: "Zaplanowane", count: reports.filter(r => r.status === "planned").length, color: "text-blue-600" },
          { label: "Zakończone", count: reports.filter(r => r.status === "completed").length, color: "text-green-600" },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-lg border border-gray-200 p-2 text-center">
            <div className={`text-lg font-bold ${stat.color}`}>{stat.count}</div>
            <div className="text-[10px] text-gray-600">{stat.label}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm mb-4">
            {search ? "Brak wyników wyszukiwania" : "Brak raportów po spotkaniach"}
          </p>
          {!search && (
            <Button onClick={() => setView("create")} className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" /> Utwórz pierwszy raport
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((report, i) => {
            const st = statusConfig[report.status || "planned"];
            return (
              <motion.button
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => { setSelectedReport(report); setView("detail"); }}
                className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900">{report.client_name}</h3>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border ${st.color}`}>{st.label}</Badge>
                      {report.photos?.length > 0 && (
                        <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                          <Image className="w-3 h-3" />{report.photos.length}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 text-xs text-gray-500">
                      {report.meeting_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(report.meeting_date).toLocaleDateString("pl-PL")}
                          {report.meeting_time && ` o ${report.meeting_time}`}
                        </span>
                      )}
                      {report.client_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{report.client_phone}</span>}
                      {report.client_address && <span className="truncate">{report.client_address}</span>}
                    </div>
                    {report.author_name && (
                      <div className="flex items-center gap-1 mt-1">
                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center text-[9px] font-bold text-green-700">
                          {report.author_name.charAt(0)}
                        </div>
                        <span className="text-xs text-gray-400">{report.author_name}</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}