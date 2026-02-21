import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, BookOpen, AlertTriangle } from "lucide-react";

function isExternalEmbed(url) {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com') || url.includes('drive.google.com');
}

function getEmbedUrl(url) {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  if (url.includes('drive.google.com/open?id=')) {
    const idMatch = url.match(/id=([^&]+)/);
    if (idMatch) return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
  }
  return url;
}

function isPrivateFileUri(url) {
  return url && !url.startsWith('http');
}

// For external embeds (YouTube/Vimeo/Drive) we can't detect onEnded reliably,
// so we show a "Ukończyłem szkolenie" button after a delay.
export default function RequiredTrainingGate({ training, currentUser, onCompleted }) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [externalConfirmEnabled, setExternalConfirmEnabled] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const loadVideo = async () => {
      if (training.video_url && isPrivateFileUri(training.video_url)) {
        setLoadingVideo(true);
        try {
          const res = await base44.integrations.Core.CreateFileSignedUrl({
            file_uri: training.video_url,
            expires_in: 7200
          });
          setSignedUrl(res.signed_url);
        } finally {
          setLoadingVideo(false);
        }
      }
    };
    loadVideo();

    // For external embeds, enable confirm button after 30 seconds
    if (training.video_url && isExternalEmbed(training.video_url)) {
      const timer = setTimeout(() => setExternalConfirmEnabled(true), 30000);
      return () => clearTimeout(timer);
    }
  }, [training]);

  const handleCompleted = async () => {
    setSaving(true);
    try {
      await base44.entities.TrainingView.create({
        training_id: training.id,
        training_title: training.title,
        user_email: currentUser.email,
        user_name: currentUser.displayName || currentUser.full_name,
        completed: true
      });
      setCompleted(true);
      setTimeout(() => onCompleted(), 1500);
    } finally {
      setSaving(false);
    }
  };

  const isExternal = training.video_url && isExternalEmbed(training.video_url);

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <CheckCircle2 className="w-20 h-20 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Szkolenie ukończone!</h2>
        <p className="text-gray-600">Za chwilę uzyskasz dostęp do aplikacji...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col">
      {/* Header */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-amber-900">Wymagane szkolenie przed dostępem do aplikacji</p>
          <p className="text-sm text-amber-700 mt-1">
            Musisz obejrzeć poniższe szkolenie do końca, aby uzyskać pełny dostęp do aplikacji.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1">
        <div className="p-4 border-b flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-green-600" />
          <div>
            <h2 className="font-bold text-lg text-gray-900">{training.title}</h2>
            {training.description && (
              <p className="text-sm text-gray-500">{training.description}</p>
            )}
          </div>
          <Badge className="ml-auto bg-red-100 text-red-700">Obowiązkowe</Badge>
        </div>

        {/* Video player */}
        {training.video_url ? (
          isExternal ? (
            <div>
              <div className="relative pt-[56.25%] bg-black">
                <iframe
                  src={getEmbedUrl(training.video_url)}
                  className="absolute inset-0 w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
              <div className="p-4 bg-gray-50 border-t text-center">
                {externalConfirmEnabled ? (
                  <div>
                    <p className="text-sm text-gray-600 mb-3">Czy obejrzałeś/aś szkolenie do końca?</p>
                    <Button
                      onClick={handleCompleted}
                      disabled={saving}
                      className="bg-green-600 hover:bg-green-700 gap-2"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Ukończyłem szkolenie
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    Obejrzyj szkolenie — przycisk potwierdzenia pojawi się po chwili...
                  </p>
                )}
              </div>
            </div>
          ) : loadingVideo ? (
            <div className="h-64 flex items-center justify-center bg-gray-900">
              <div className="text-center text-white">
                <Loader2 className="w-10 h-10 animate-spin mx-auto mb-2" />
                <p className="text-sm">Ładowanie wideo...</p>
              </div>
            </div>
          ) : signedUrl ? (
            <div>
              <div className="bg-black" onContextMenu={(e) => e.preventDefault()}>
                <video
                  ref={videoRef}
                  src={signedUrl}
                  className="w-full max-h-[60vh]"
                  controls
                  controlsList="nodownload nofullscreen"
                  disablePictureInPicture
                  onContextMenu={(e) => e.preventDefault()}
                  onEnded={handleCompleted}
                />
              </div>
              <div className="p-4 bg-gray-50 border-t text-center">
                <p className="text-sm text-gray-500 italic">
                  Przycisk pojawi się automatycznie po zakończeniu odtwarzania.
                </p>
              </div>
            </div>
          ) : null
        ) : (
          <div className="h-48 flex items-center justify-center bg-gray-50">
            <p className="text-gray-400">Brak wideo dla tego szkolenia</p>
          </div>
        )}
      </div>
    </div>
  );
}