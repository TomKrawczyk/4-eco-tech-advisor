import { useState } from "react";

const KEY = "today_hidden_tasks";

function load() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch (_) {
    return new Set();
  }
}

// Lokalne ukrywanie zadań (raporty telefoniczne, wydarzenia) na liście "Dziś do zrobienia"
export default function useHiddenTasks() {
  const [hidden, setHidden] = useState(load);

  const hide = (id) => {
    setHidden(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch (_) {}
      return next;
    });
  };

  return { isHidden: (id) => hidden.has(id), hide };
}