import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, CheckCircle2, Clock, Users, Plus, BookOpen, BarChart2, Trash2, Upload, Link, Loader2, Pencil } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Progress } from "@/components/ui/progress";

const categoryLabels = {
  sprzedaz: "Sprzedaż",
  techniczne: "Techniczne",
  produkty: "Produkty",
  procesy: "Procesy",
  inne: "Inne"
};

const categoryColors = {
  sprzedaz: "bg-blue-100 text-blue-800",
  techniczne: "bg-orange-100 text-orange-800",
  produkty: "bg-green-100 text-green-800",
  procesy: "bg-purple-100 text-purple-800",
  inne: "bg-gray-100 text-gray-800"
};

function isExternalEmbed(url) {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com') || url.includes('drive.google.com');
}

function getEmbedUrl(url) {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  // Google Drive - różne formaty linków
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  if (url.includes('drive.google.com/open?id=')) {
    const idMatch = url.match(/id=([^&]+)/);
    if (idMatch) return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
  }
  return url;
}

function isPrivateFileUri(url) {
  // Private file URIs don't start with http
  return url && !url.startsWith('http');
}

export default function Education() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTraining, setEditingTraining] = useState(null);
  const [formData, setFormData] = useState({
    title: "", description: "", category: "sprzedaz",
    video_url: "", duration_minutes: "", is_required: false
  });
  const [uploadMode, setUploadMode] = useState("url"); // "url" | "file"
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState("");

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      const allowedUsers = await base44.entities.AllowedUser.list();
      const userAccess = allowedUsers.find(a => (a.data?.email || a.email) === user.email);
      if (userAccess) {
        user.role = userAccess.data?.role || userAccess.role;
        user.displayName = userAccess.data?.name || userAccess.name;
      }
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  const { data: trainings = [] } = useQuery({
    queryKey: ['trainings'],
    queryFn: () => base44.entities.Training.list('order'),
    enabled: !!currentUser
  });

  const { data: myViews = [] } = useQuery({
    queryKey: ['trainingViews', currentUser?.email],
    queryFn: () => base44.entities.TrainingView.filter({ user_email: currentUser.email }),
    enabled: !!currentUser?.email
  });

  const { data: allViews = [] } = useQuery({
    queryKey: ['allTrainingViews'],
    queryFn: () => base44.entities.TrainingView.list(),
    enabled: currentUser?.role === 'admin'
  });

  const { data: allowedUsers = [] } = useQuery({
    queryKey: ['allowedUsers'],
    queryFn: () => base44.entities.AllowedUser.list(),
    enabled: !!currentUser
  });

  const markViewedMutation = useMutation({
    mutationFn: async (training) => {
      const existing = myViews.find(v => v.training_id === training.id);
      if (!existing) {
        await base44.entities.TrainingView.create({
          training_id: training.id,
          training_title: training.title,
          user_email: currentUser.email,
          user_name: currentUser.displayName || currentUser.full_name,
          completed: true
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries(['trainingViews', currentUser?.email])
  });

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);

    // Symulacja progresu podczas uploadu
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 5, 90));
    }, 300);

    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      setUploadedVideoUrl(file_uri);
      setFormData(prev => ({ ...prev, video_url: file_uri }));
      setUploadProgress(100);
    } finally {
      clearInterval(progressInterval);
      setUploading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Training.create({
      ...data,
      video_url: uploadMode === "file" ? uploadedVideoUrl : data.video_url,
      duration_minutes: data.duration_minutes ? Number(data.duration_minutes) : undefined,
      order: trainings.length + 1
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['trainings']);
      setShowAddDialog(false);
      setFormData({ title: "", description: "", category: "sprzedaz", video_url: "", duration_minutes: "", is_required: false });
      setUploadedVideoUrl("");
      setUploadProgress(0);
      setUploadMode("url");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Training.update(id, {
      ...data,
      video_url: uploadMode === "file" ? uploadedVideoUrl || data.video_url : data.video_url,
      duration_minutes: data.duration_minutes ? Number(data.duration_minutes) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['trainings']);
      setEditingTraining(null);
      setFormData({ title: "", description: "", category: "sprzedaz", video_url: "", duration_minutes: "", is_required: false });
      setUploadedVideoUrl("");
      setUploadProgress(0);
      setUploadMode("url");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Training.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['trainings'])
  });

  const handleEdit = (training) => {
    setEditingTraining(training);
    setFormData({
      title: training.title || "",
      description: training.description || "",
      category: training.category || "sprzedaz",
      video_url: training.video_url || "",
      duration_minutes: training.duration_minutes || "",
      is_required: training.is_required || false
    });
    setUploadMode("url");
    setUploadedVideoUrl("");
  };

  const [signedVideoUrl, setSignedVideoUrl] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(false);

  const handleOpenTraining = async (training) => {
    setSelectedTraining(training);
    setSignedVideoUrl(null);
    markViewedMutation.mutate(training);

    if (training.video_url && isPrivateFileUri(training.video_url)) {
      setLoadingVideo(true);
      try {
        const res = await base44.integrations.Core.CreateFileSignedUrl({
          file_uri: training.video_url,
          expires_in: 3600
        });
        setSignedVideoUrl(res.signed_url);
      } finally {
        setLoadingVideo(false);
      }
    }
  };

  const handleDownloadAttempt = async (training) => {
    // Notify all admins about the download attempt
    const admins = allowedUsers.filter(u => (u.data?.role || u.role) === 'admin');
    for (const admin of admins) {
      const adminEmail = admin.data?.email || admin.email;
      await base44.entities.Notification.create({
        user_email: adminEmail,
        type: "system_error",
        title: "⚠️ Próba pobrania nagrania",
        message: `Użytkownik ${currentUser?.displayName || currentUser?.email} próbował pobrać szkolenie: "${training.title}"`,
        link: ""
      });
    }
  };

  const isCompleted = (trainingId) => myViews.some(v => v.training_id === trainingId);

  const filteredTrainings = trainings.filter(t =>
    t.is_published !== false &&
    (categoryFilter === "all" || t.category === categoryFilter)
  );

  const completedCount = trainings.filter(t => isCompleted(t.id)).length;

  // Stats per training for admin
  const getViewCount = (trainingId) => allViews.filter(v => v.training_id === trainingId).length;

  return (
    <div>
      <PageHeader title="Szkolenia" subtitle="Rozwijaj swoje kompetencje sprzedażowe i techniczne" />

      {/* Progress bar */}
      {trainings.length > 0 && (
        <Card className="p-4 mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Twój postęp</span>
            <span className="text-sm font-bold text-green-700">{completedCount}/{trainings.filter(t => t.is_published !== false).length} szkoleń</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${trainings.filter(t => t.is_published !== false).length > 0 ? (completedCount / trainings.filter(t => t.is_published !== false).length) * 100 : 0}%` }}
            />
          </div>
        </Card>
      )}

      <Tabs defaultValue="trainings" className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="trainings"><BookOpen className="w-4 h-4 mr-1" />Szkolenia</TabsTrigger>
            {currentUser?.role === 'admin' && (
              <TabsTrigger value="stats"><BarChart2 className="w-4 h-4 mr-1" />Statystyki</TabsTrigger>
            )}
          </TabsList>

          <div className="flex items-center gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Kategoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
                {Object.entries(categoryLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {currentUser?.role === 'admin' && (
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700 gap-2">
                    <Plus className="w-4 h-4" />Dodaj szkolenie
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Nowe szkolenie</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
                    <div>
                      <Label>Tytuł *</Label>
                      <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
                    </div>
                    <div>
                      <Label>Opis</Label>
                      <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Kategoria</Label>
                        <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(categoryLabels).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Czas (min)</Label>
                        <Input type="number" value={formData.duration_minutes} onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label className="mb-2 block">Wideo</Label>
                      <div className="flex gap-2 mb-2">
                        <Button type="button" size="sm" variant={uploadMode === "url" ? "default" : "outline"} onClick={() => setUploadMode("url")} className="gap-1">
                          <Link className="w-3 h-3" />Link
                        </Button>
                        <Button type="button" size="sm" variant={uploadMode === "file" ? "default" : "outline"} onClick={() => setUploadMode("file")} className="gap-1">
                          <Upload className="w-3 h-3" />Plik wideo
                        </Button>
                      </div>

                      {uploadMode === "url" ? (
                        <Input placeholder="https://youtube.com/watch?v=..." value={formData.video_url} onChange={(e) => setFormData({ ...formData, video_url: e.target.value })} />
                      ) : (
                        <div>
                          <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploading ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400 hover:bg-green-50'}`}>
                            <input
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                              disabled={uploading}
                            />
                            {uploading ? (
                              <div className="text-center w-full px-4">
                                <Loader2 className="w-6 h-6 text-green-600 animate-spin mx-auto mb-1" />
                                <p className="text-sm text-green-700 mb-2">Przesyłanie... {uploadProgress}%</p>
                                <Progress value={uploadProgress} className="h-2" />
                              </div>
                            ) : uploadedVideoUrl ? (
                              <div className="text-center">
                                <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-1" />
                                <p className="text-sm text-green-700 font-medium">Plik przesłany!</p>
                                <p className="text-xs text-gray-500">Kliknij aby zmienić plik</p>
                              </div>
                            ) : (
                              <div className="text-center">
                                <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                                <p className="text-sm text-gray-600">Kliknij lub przeciągnij plik wideo</p>
                                <p className="text-xs text-gray-400 mt-1">MP4, MOV, AVI, MKV – duże pliki OK</p>
                              </div>
                            )}
                          </label>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
                      <input
                        type="checkbox"
                        id="is_required_create"
                        checked={formData.is_required}
                        onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                        className="w-4 h-4 accent-red-600"
                      />
                      <label htmlFor="is_required_create" className="text-sm font-medium text-red-800 cursor-pointer">
                        🔒 Szkolenie obowiązkowe — blokuje dostęp do czasu ukończenia
                      </label>
                    </div>
                    <Button type="submit" disabled={createMutation.isPending || uploading} className="w-full bg-green-600 hover:bg-green-700">
                      Dodaj szkolenie
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Edit Dialog */}
        {editingTraining && (
          <Dialog open={!!editingTraining} onOpenChange={(open) => { if (!open) { setEditingTraining(null); setUploadedVideoUrl(""); setUploadMode("url"); } }}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Edytuj szkolenie</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate({ id: editingTraining.id, data: formData }); }} className="space-y-4">
                <div>
                  <Label>Tytuł *</Label>
                  <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
                </div>
                <div>
                  <Label>Opis</Label>
                  <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Kategoria</Label>
                    <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Czas (min)</Label>
                    <Input type="number" value={formData.duration_minutes} onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Wideo</Label>
                  <div className="flex gap-2 mb-2">
                    <Button type="button" size="sm" variant={uploadMode === "url" ? "default" : "outline"} onClick={() => setUploadMode("url")} className="gap-1">
                      <Link className="w-3 h-3" />Link
                    </Button>
                    <Button type="button" size="sm" variant={uploadMode === "file" ? "default" : "outline"} onClick={() => setUploadMode("file")} className="gap-1">
                      <Upload className="w-3 h-3" />Nowy plik
                    </Button>
                  </div>
                  {uploadMode === "url" ? (
                    <Input placeholder="https://youtube.com/watch?v=..." value={formData.video_url} onChange={(e) => setFormData({ ...formData, video_url: e.target.value })} />
                  ) : (
                    <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploading ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400 hover:bg-green-50'}`}>
                      <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} disabled={uploading} />
                      {uploading ? (
                        <div className="text-center w-full px-4">
                          <Loader2 className="w-5 h-5 text-green-600 animate-spin mx-auto mb-1" />
                          <p className="text-sm text-green-700 mb-1">Przesyłanie... {uploadProgress}%</p>
                          <Progress value={uploadProgress} className="h-1.5" />
                        </div>
                      ) : uploadedVideoUrl ? (
                        <div className="text-center">
                          <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto mb-1" />
                          <p className="text-xs text-green-700">Plik przesłany! Kliknij aby zmienić</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                          <p className="text-xs text-gray-500">Zastąp obecne wideo nowym plikiem</p>
                        </div>
                      )}
                    </label>
                  )}
                </div>
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
                  <input
                    type="checkbox"
                    id="is_required_edit"
                    checked={formData.is_required}
                    onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                    className="w-4 h-4 accent-red-600"
                  />
                  <label htmlFor="is_required_edit" className="text-sm font-medium text-red-800 cursor-pointer">
                    🔒 Szkolenie obowiązkowe — blokuje dostęp do czasu ukończenia
                  </label>
                </div>
                <Button type="submit" disabled={updateMutation.isPending || uploading} className="w-full bg-green-600 hover:bg-green-700">
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Zapisz zmiany
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}

        <TabsContent value="trainings">
          {filteredTrainings.length === 0 ? (
            <Card className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Brak szkoleń w tej kategorii</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTrainings.map((training) => {
                const completed = isCompleted(training.id);
                return (
                  <Card key={training.id} className={`p-5 hover:shadow-md transition-shadow cursor-pointer border-2 ${completed ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge className={categoryColors[training.category]}>
                            {categoryLabels[training.category]}
                          </Badge>
                          {training.is_required && (
                            <Badge className="bg-red-100 text-red-700">Obowiązkowe</Badge>
                          )}
                          {completed && (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle2 className="w-3 h-3 mr-1" />Ukończone
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-gray-900">{training.title}</h3>
                      </div>
                      {currentUser?.role === 'admin' && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(training)} className="text-gray-400 hover:text-blue-600 shrink-0">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(training.id)} className="text-red-400 hover:text-red-600 shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {training.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{training.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {training.duration_minutes && (
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{training.duration_minutes} min</span>
                        )}
                        {currentUser?.role === 'admin' && (
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{getViewCount(training.id)} osób</span>
                        )}
                      </div>
                      <Button size="sm" onClick={() => handleOpenTraining(training)} className="bg-green-600 hover:bg-green-700 gap-1">
                        <Play className="w-3 h-3" />Obejrzyj
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {currentUser?.role === 'admin' && (
          <TabsContent value="stats">
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="text-sm text-gray-600">Szkolenia</div>
                  <div className="text-2xl font-bold">{trainings.filter(t => t.is_published !== false).length}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-gray-600">Łącznie odsłon</div>
                  <div className="text-2xl font-bold text-green-600">{allViews.length}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-gray-600">Aktywni uczący się</div>
                  <div className="text-2xl font-bold text-blue-600">{new Set(allViews.map(v => v.user_email)).size}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-gray-600">Handlowcy</div>
                  <div className="text-2xl font-bold text-purple-600">{allowedUsers.length}</div>
                </Card>
              </div>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Postęp per szkolenie</h3>
                <div className="space-y-4">
                  {trainings.filter(t => t.is_published !== false).map(training => {
                    const viewCount = getViewCount(training.id);
                    const percent = allowedUsers.length > 0 ? Math.round((viewCount / allowedUsers.length) * 100) : 0;
                    const viewers = allViews.filter(v => v.training_id === training.id);
                    return (
                      <div key={training.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-medium text-gray-900">{training.title}</span>
                            <Badge className={`ml-2 ${categoryColors[training.category]}`}>{categoryLabels[training.category]}</Badge>
                          </div>
                          <span className="text-sm font-bold text-gray-700">{viewCount}/{allowedUsers.length} osób ({percent}%)</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${percent}%` }} />
                        </div>
                        {viewers.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {viewers.map((v, i) => (
                              <span key={i} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                                {v.user_name || v.user_email}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Postęp per handlowiec</h3>
                <div className="space-y-3">
                  {allowedUsers.map(u => {
                    const userEmail = u.data?.email || u.email;
                    const userName = u.data?.name || u.name;
                    const userViewCount = allViews.filter(v => v.user_email === userEmail).length;
                    const totalPublished = trainings.filter(t => t.is_published !== false).length;
                    const percent = totalPublished > 0 ? Math.round((userViewCount / totalPublished) * 100) : 0;
                    return (
                      <div key={u.id} className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm shrink-0">
                          {userName?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900">{userName}</span>
                            <span className="text-xs text-gray-500">{userViewCount}/{totalPublished} ({percent}%)</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Modal z wideo */}
      {selectedTraining && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => { setSelectedTraining(null); setSignedVideoUrl(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="font-bold text-lg text-gray-900">{selectedTraining.title}</h2>
                <Badge className={categoryColors[selectedTraining.category]}>{categoryLabels[selectedTraining.category]}</Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setSelectedTraining(null); setSignedVideoUrl(null); }}>✕</Button>
            </div>
            {selectedTraining.video_url ? (
              isExternalEmbed(selectedTraining.video_url) ? (
                <div className="relative pt-[56.25%] bg-black">
                  <iframe
                    src={getEmbedUrl(selectedTraining.video_url)}
                    className="absolute inset-0 w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                </div>
              ) : loadingVideo ? (
                <div className="h-64 flex items-center justify-center bg-gray-900">
                  <div className="text-center text-white">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Ładowanie wideo...</p>
                  </div>
                </div>
              ) : signedVideoUrl ? (
                <div
                  className="relative bg-black"
                  onContextMenu={(e) => { e.preventDefault(); handleDownloadAttempt(selectedTraining); }}
                >
                  <video
                    src={signedVideoUrl}
                    className="w-full max-h-[60vh]"
                    controls
                    controlsList="nodownload nofullscreen"
                    disablePictureInPicture
                    onContextMenu={(e) => e.preventDefault()}
                  />
                  {/* Invisible overlay to block right-click on video */}
                  <div
                    className="absolute inset-0 pointer-events-none select-none"
                    style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                  />
                </div>
              ) : null
            ) : (
              <div className="h-64 flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-400">
                  <Play className="w-12 h-12 mx-auto mb-2" />
                  <p>Brak linku do wideo</p>
                </div>
              </div>
            )}
            {selectedTraining.description && (
              <div className="p-4">
                <p className="text-sm text-gray-700">{selectedTraining.description}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}