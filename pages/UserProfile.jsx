import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";
import { User, Mail, Shield, Bell, Save, Check } from "lucide-react";
import { toast } from "react-hot-toast";

export default function UserProfile() {
  const [currentUser, setCurrentUser] = useState(null);
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then((user) => {
      setCurrentUser(user);
      setFullName(user.full_name || "");
    });
  }, []);

  const { data: preferences, isLoading: prefsLoading } = useQuery({
    queryKey: ["notificationPreferences", currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return null;
      const prefs = await base44.entities.NotificationPreference.filter({ user_email: currentUser.email });
      return prefs[0] || null;
    },
    enabled: !!currentUser,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      await base44.auth.updateMe(data);
    },
    onSuccess: () => {
      toast.success("Profil zaktualizowany");
      setSaving(false);
      base44.auth.me().then(setCurrentUser);
    },
    onError: () => {
      setSaving(false);
    },
  });

  const createPreferencesMutation = useMutation({
    mutationFn: (data) => base44.entities.NotificationPreference.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["notificationPreferences"]);
      toast.success("Preferencje zapisane");
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.NotificationPreference.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["notificationPreferences"]);
      toast.success("Preferencje zapisane");
    },
  });

  const handleSaveProfile = () => {
    if (!fullName.trim()) {
      toast.error("Imię i nazwisko nie może być puste");
      return;
    }
    setSaving(true);
    updateProfileMutation.mutate({ full_name: fullName });
  };

  const handleToggleNotification = async (field, value) => {
    if (!currentUser) return;

    const newData = {
      ...preferences,
      [field]: value,
      user_email: currentUser.email,
    };

    if (preferences?.id) {
      updatePreferencesMutation.mutate({ id: preferences.id, data: newData });
    } else {
      createPreferencesMutation.mutate(newData);
    }
  };

  const notificationTypes = [
    {
      title: "Nowe raporty",
      description: "Powiadomienia o utworzeniu nowych raportów",
      inAppField: "new_report_in_app",
      emailField: "new_report_email",
    },
    {
      title: "Błędy systemowe",
      description: "Powiadomienia o błędach technicznych",
      inAppField: "system_errors_in_app",
      emailField: "system_errors_email",
    },
    {
      title: "Aktywność użytkowników",
      description: "Powiadomienia o akcjach użytkowników (tylko admin)",
      inAppField: "user_activity_in_app",
      emailField: "user_activity_email",
      adminOnly: true,
    },
  ];

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Mój profil" subtitle="Zarządzaj swoimi danymi i ustawieniami" />

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">Dane osobowe</TabsTrigger>
          <TabsTrigger value="notifications">Powiadomienia</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Dane osobowe
              </CardTitle>
              <CardDescription>Zaktualizuj swoje informacje osobiste</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Imię i nazwisko *</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jan Kowalski"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Email</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input value={currentUser.email} disabled className="bg-gray-50" />
                  <Mail className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Email jest zarządzany przez system i nie może być zmieniony</p>
              </div>

              <div>
                <Label>Rola</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    value={currentUser.role === "admin" ? "Administrator" : "Użytkownik"}
                    disabled
                    className="bg-gray-50"
                  />
                  <Shield className="w-5 h-5 text-gray-400" />
                </div>
              </div>

              <Separator />

              <Button onClick={handleSaveProfile} disabled={saving} className="w-full sm:w-auto">
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Zapisz zmiany
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">Uwierzytelnianie i bezpieczeństwo</p>
                  <p className="text-blue-700">
                    Logowanie, hasła i bezpieczeństwo konta są zarządzane przez system Base44. 
                    Skontaktuj się z administratorem systemu w kwestiach dotyczących bezpieczeństwa konta.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          {prefsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {notificationTypes.map((type) => {
                if (type.adminOnly && currentUser.role !== "admin") return null;
                const inAppValue = preferences?.[type.inAppField] ?? true;
                const emailValue = preferences?.[type.emailField] ?? false;

                return (
                  <Card key={type.title}>
                    <CardHeader>
                      <CardTitle className="text-base">{type.title}</CardTitle>
                      <CardDescription className="text-sm">{type.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-gray-500" />
                          <Label className="text-sm font-normal">W aplikacji</Label>
                        </div>
                        <Switch
                          checked={inAppValue}
                          onCheckedChange={(checked) => handleToggleNotification(type.inAppField, checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-500" />
                          <Label className="text-sm font-normal">Email</Label>
                        </div>
                        <Switch
                          checked={emailValue}
                          onCheckedChange={(checked) => handleToggleNotification(type.emailField, checked)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-green-900">
                      <p className="font-medium mb-1">Zmiany zapisują się automatycznie</p>
                      <p className="text-green-700">Preferencje są natychmiast aktualizowane po każdej zmianie.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}