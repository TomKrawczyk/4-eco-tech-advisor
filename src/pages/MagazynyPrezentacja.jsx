import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import useCurrentUser from "@/components/shared/useCurrentUser";
import ChecklistAccessNotice from "@/components/checklist/ChecklistAccessNotice";
import GroupAccessManager from "@/components/external-apps/GroupAccessManager";

const ADMIN_APP_URL = "https://4-eco-prezentacja-magazyny-app.base44.app/";
const VIEW_ONLY_APP_URL = "https://4-eco-prezentacja-magazyny-app.base44.app/?view=preview";
const TEMPLATE_SLUG = "magazyny-prezentacja";

export default function MagazynyPrezentacja() {
  const { currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const effectiveUserGroupId = currentUser?.groupId || currentUser?.group_id || currentUser?.data?.group_id || null;

  const [templates, setTemplates] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.ChecklistTemplate.list(),
      base44.entities.Group.list(),
    ]).then(([templatesData, groupsData]) => {
      setTemplates(templatesData);
      setGroups(groupsData);
    });
  }, []);

  const accessTemplate = useMemo(() => {
    return templates.find((template) => (template.data?.slug || template.slug) === TEMPLATE_SLUG) || null;
  }, [templates]);

  const allowedGroupIds = accessTemplate?.data?.allowed_group_ids || accessTemplate?.allowed_group_ids || [];
  const canUsePage = isAdmin || allowedGroupIds.length === 0 || (effectiveUserGroupId && allowedGroupIds.includes(effectiveUserGroupId));

  useEffect(() => {
    setSelectedGroupIds(allowedGroupIds);
  }, [accessTemplate?.id, JSON.stringify(allowedGroupIds)]);

  const toggleGroup = (groupId) => {
    setSelectedGroupIds((prev) => prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]);
  };

  const saveGroups = async () => {
    setSaving(true);

    if (accessTemplate?.id) {
      await base44.entities.ChecklistTemplate.update(accessTemplate.id, {
        allowed_group_ids: selectedGroupIds,
        is_active: true,
      });
    } else {
      await base44.entities.ChecklistTemplate.create({
        name: "Prezentacja magazynów",
        slug: TEMPLATE_SLUG,
        version: "2026-05",
        is_active: true,
        allowed_group_ids: selectedGroupIds,
      });
    }

    const templatesData = await base44.entities.ChecklistTemplate.list();
    setTemplates(templatesData);
    setSaving(false);
  };

  if (!canUsePage) {
    return (
      <div className="space-y-6">
        <PageHeader title="Prezentacja magazynów" subtitle="Dostęp ograniczony do wybranych grup" />
        <ChecklistAccessNotice />
      </div>
    );
  }

  const iframeUrl = isAdmin ? ADMIN_APP_URL : VIEW_ONLY_APP_URL;

  return (
    <div className="space-y-6">
      <PageHeader title="Prezentacja magazynów" />

      {isAdmin && (
        <GroupAccessManager
          title="Dostęp do prezentacji"
          description="Wybierz grupy, które mogą korzystać z tej prezentacji."
          groups={groups}
          selectedGroupIds={selectedGroupIds}
          onToggleGroup={toggleGroup}
          onSave={saveGroups}
          saving={saving}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <iframe
          src={iframeUrl}
          title="Prezentacja magazynów"
          className="w-full min-h-[80vh]"
        />
      </div>
    </div>
  );
}