import React, { useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { isSlaBreached } from "@/lib/gieldaData";
import GieldaPinCard from "./GieldaPinCard";

const POLAND_CENTER = [52.1, 19.3];
const POLAND_MAX_BOUNDS = L.latLngBounds([48.8, 14.0], [55.0, 24.5]);
const MAX_MARKERS = 300;

// Romb (diamond) dla spotkań — DOM marker (spotkań jest mało dzięki oknu dziś+3)
function diamondIcon(color, selected) {
  const size = selected ? 18 : 14;
  return L.divIcon({
    className: "gielda-diamond",
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:2px solid #fff;transform:rotate(45deg);box-shadow:0 1px 3px rgba(0,0,0,0.4);${selected ? "outline:2px solid #1d4ed8;outline-offset:1px;" : ""}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Kolor kontaktu wg statusu
function contactColor(pin) {
  if (pin.isAssigned) return "#22c55e";
  if (pin.source === "PhoneContact" && pin.phone_status === "Kontakt do doradcy") return "#ef4444"; // czerwone
  if (pin.source === "PhoneContact" && pin.phone_status === "Do ponownego kontaktu") return "#f97316"; // pomarańczowe
  return "#eab308"; // ContactLead — żółte
}

function contactStyle(pin, selected) {
  const sla = !pin.isAssigned && isSlaBreached(pin);
  return {
    color: "#fff",
    weight: sla ? 4 : selected ? 3 : 2,
    fillColor: contactColor(pin),
    fillOpacity: 0.95,
    radius: sla ? 7 : selected ? 8 : 6,
  };
}

// Sortowanie "najgorętsze pierwsze" do kapowania
function hotSort(a, b, tab) {
  if (tab === "meeting") {
    const da = a.meeting_date || "9999";
    const db = b.meeting_date || "9999";
    if (da !== db) return da.localeCompare(db);
    return (a.meeting_calendar || "").localeCompare(b.meeting_calendar || "");
  }
  const aSla = isSlaBreached(a) ? 0 : 1;
  const bSla = isSlaBreached(b) ? 0 : 1;
  if (aSla !== bSla) return aSla - bSla;
  return new Date(b.created_date || 0) - new Date(a.created_date || 0);
}

function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom ?? map.getZoom(), { animate: true });
  }, [center, zoom, map]);
  return null;
}

// Re-fit przy zmianie zakładki (resetKey) — mapa pozostaje zamontowana
function FitBounds({ points, resetKey }) {
  const map = useMap();
  const didFit = useRef(false);
  useEffect(() => {
    didFit.current = false;
  }, [resetKey]);
  useEffect(() => {
    if (didFit.current) return;
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points).pad(0.2), { animate: true });
      didFit.current = true;
    }
  }, [points, map]);
  return null;
}

export default function GieldaMap({ pins, geoByCode, currentUser, onClaim, claimedIds, busyId, selectedId, onSelect, flyTo, tab }) {
  const { validPins, fitPoints } = useMemo(() => {
    const valid = [];
    const pts = [];
    for (const p of pins) {
      const g = geoByCode[p.postal_code];
      if (g && typeof g.lat === "number" && typeof g.lon === "number") {
        valid.push(p);
        pts.push([g.lat, g.lon]);
      }
    }
    valid.sort((a, b) => hotSort(a, b, tab));
    return { validPins: valid.slice(0, MAX_MARKERS), fitPoints: pts };
  }, [pins, geoByCode, tab]);

  const capped = validPins.length === MAX_MARKERS;

  const renderPin = (pin) => {
    const g = geoByCode[pin.postal_code];
    const isSel = selectedId === pin.id;
    const card = (
      <Popup>
        <div className="p-2">
          <GieldaPinCard
            pin={pin}
            geo={g}
            currentUser={currentUser}
            onClaim={onClaim}
            claimed={claimedIds.has(pin.id)}
            busy={busyId === pin.id}
          />
        </div>
      </Popup>
    );

    if (pin.type === "spotkanie") {
      const color = pin.isAssigned ? "#22c55e" : "#3b82f6";
      return (
        <Marker
          key={pin.id}
          position={[g.lat, g.lon]}
          icon={diamondIcon(color, isSel)}
          eventHandlers={{ click: () => onSelect(pin) }}
          zIndexOffset={isSel ? 1000 : 0}
        >
          {card}
        </Marker>
      );
    }
    const style = contactStyle(pin, isSel);
    return (
      <CircleMarker
        key={pin.id}
        center={[g.lat, g.lon]}
        pathOptions={style}
        radius={style.radius}
        eventHandlers={{ click: () => onSelect(pin) }}
        zIndexOffset={isSel ? 1000 : 0}
      >
        {card}
      </CircleMarker>
    );
  };

  return (
    <div className="relative w-full h-full">
      <style>{`
        .leaflet-container { font-family: inherit; }
        .leaflet-popup-content-wrapper { border-radius: 12px; padding: 0; overflow: hidden; }
        .leaflet-popup-content { margin: 0; width: 240px !important; }
        .gielda-diamond { background: transparent; border: none; }
      `}</style>
      <MapContainer
        center={POLAND_CENTER}
        zoom={6}
        minZoom={5}
        maxZoom={18}
        maxBounds={POLAND_MAX_BOUNDS}
        maxBoundsViscosity={0.8}
        preferCanvas={true}
        className="w-full h-full z-0"
        style={{ background: "#aadaff" }}
      >
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        <FitBounds points={fitPoints} resetKey={tab} />
        {flyTo && <Recenter center={flyTo} zoom={13} />}
        {validPins.map(renderPin)}
      </MapContainer>
      {capped && (
        <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur px-2.5 py-1 rounded-md shadow text-[11px] text-gray-600 z-[500]">
          Pokazano {MAX_MARKERS} najgorętszych pinów (przybliż, by zobaczyć więcej)
        </div>
      )}
    </div>
  );
}