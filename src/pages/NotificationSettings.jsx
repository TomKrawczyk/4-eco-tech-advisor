import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import { Bell, Mail, AlertCircle, FileText, Users, Check } from "lucide-react";
import { toast } from "react-hot-toast";

export default function NotificationSettings() {
  const [currentUser, setCurrentUser] = React.useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["notificationPreferences", currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return null;
      const prefs = await base44.entities.NotificationPreference.filter({ user_email: currentUser.email });
      return prefs[0] || null;
    },
    enabled: !!currentUser,
  });

  const createPreferencesMutation = useMutation({
    mutationFn: (data) => base44.entities.NotificationPreference.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["notificationPreferences"]);
      toast.success("Ustawienia zapisane");
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.NotificationPreference.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["notificationPreferences"]);
      toast.success("Ustawienia zapisane");
    },
  });

  const handleToggle = async (field, value) => {
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
      icon: FileText,
      title: "Nowe raporty",
      description: "Powiadomienia o utworzeniu nowych raportów wizyt",
      inAppField: "new_report_in_app",
      emailField: "new_report_email",
    },
    {
      icon: AlertCircle,
      title: "Błędy systemowe",
      description: "Powiadomienia o błędach i problemach technicznych",
      inAppField: "system_errors_in_app",
      emailField: "system_errors_email",
    },
    {
      icon: Users,
      title: "Aktywność użytkowników",
      description: "Powiadomienia o akcjach innych użytkowników",
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
      <PageHeader
        title="Ustawienia powiadomień"
        subtitle="Zarządzaj swoimi preferencjami dotyczącymi powiadomień"
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {notificationTypes.map((type) => {
            if (type.adminOnly && currentUser.role !== "admin") return null;
            const Icon = type.icon;
            const inAppValue = preferences?.[type.inAppField] ?? true;
            const emailValue = preferences?.[type.emailField] ?? false;

            return (
              <Card key={type.title}>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{type.title}</CardTitle>
                      <CardDescription className="text-sm">{type.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-gray-500" />
                      <Label className="text-sm font-normal">W aplikacji</Label>
                    </div>
                    <Switch
                      checked={inAppValue}
                      onCheckedChange={(checked) => handleToggle(type.inAppField, checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <Label className="text-sm font-normal">Email</Label>
                    </div>
                    <Switch
                      checked={emailValue}
                      onCheckedChange={(checked) => handleToggle(type.emailField, checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">Zmiany zapisują się automatycznie</p>
                  <p className="text-blue-700">Twoje preferencje są natychmiast aktualizowane po każdej zmianie.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}