import React, { useEffect, useState } from "react";

// Półprzezroczysty, powtarzalny znak wodny z danymi użytkownika — widoczny na każdym zrzucie ekranu.
export default function ScreenWatermark({ user }) {
  const [stamp, setStamp] = useState(() => new Date().toLocaleString("pl-PL"));

  useEffect(() => {
    const id = setInterval(() => setStamp(new Date().toLocaleString("pl-PL")), 60000);
    return () => clearInterval(id);
  }, []);

  if (!user) return null;

  const label = `${user.displayName || user.full_name || ""} • ${user.email} • ${stamp}`;
  const rows = Array.from({ length: 14 });

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[65] overflow-hidden select-none"
    >
      <div className="absolute inset-[-25%] flex flex-col justify-around -rotate-[30deg]">
        {rows.map((_, i) => (
          <div
            key={i}
            className="whitespace-nowrap text-[13px] md:text-base font-bold tracking-wide text-gray-900/[0.16]"
          >
            {`${label}     ${label}     ${label}     ${label}`}
          </div>
        ))}
      </div>
    </div>
  );
}