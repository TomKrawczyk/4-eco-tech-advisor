import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Bell, FileText, AlertCircle, Users, X, CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const typeIcons = {
  new_report: FileText,
  system_error: AlertCircle,
  user_activity: Users,
};

const typeColors = {
  new_report: "text-green-600 bg-green-50",
  system_error: "text-red-600 bg-red-50",
  user_activity: "text-blue-600 bg-blue-50",
};

export default function NotificationPanel({ currentUser }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      return await base44.entities.Notification.filter(
        { user_email: currentUser.email },
        "-created_date",
        50
      );
    },
    enabled: !!currentUser,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(["notifications"]);
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter((n) => !n.is_read);
      await Promise.all(unread.map((n) => base44.entities.Notification.update(n.id, { is_read: true })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["notifications"]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["notifications"]);
    },
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id);
    }
    setOpen(false);
  };

  if (!currentUser) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 md:w-96 p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Powiadomienia</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              className="h-8 text-xs"
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              Oznacz wszystkie
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Bell className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">Brak powiadomień</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = typeIcons[notification.type] || Bell;
                const colorClass = typeColors[notification.type] || "text-gray-600 bg-gray-50";

                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      !notification.is_read ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {notification.link ? (
                          <Link
                            to={notification.link}
                            onClick={() => handleNotificationClick(notification)}
                            className="block"
                          >
                            <h4 className="text-sm font-medium text-gray-900 mb-1">
                              {notification.title}
                              {!notification.is_read && (
                                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full ml-2"></span>
                              )}
                            </h4>
                            <p className="text-xs text-gray-600 line-clamp-2">{notification.message}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(notification.created_date).toLocaleString("pl-PL")}
                            </p>
                          </Link>
                        ) : (
                          <>
                            <h4 className="text-sm font-medium text-gray-900 mb-1">
                              {notification.title}
                              {!notification.is_read && (
                                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full ml-2"></span>
                              )}
                            </h4>
                            <p className="text-xs text-gray-600">{notification.message}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(notification.created_date).toLocaleString("pl-PL")}
                            </p>
                          </>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(notification.id)}
                        className="h-6 w-6 shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t bg-gray-50">
          <Link to={createPageUrl("NotificationSettings")} onClick={() => setOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full text-xs">
              Ustawienia powiadomień
            </Button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}