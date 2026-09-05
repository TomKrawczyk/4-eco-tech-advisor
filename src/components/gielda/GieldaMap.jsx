import React, { useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { isSlaBreached, isFresh, isMeetingNear } from "@/lib/gieldaData";
import GieldaPinCard from "./GieldaPinCard";

const POLAND_CENTER = [52.1, 19.3];
const POLAND_MAX_BOUNDS = L.latLngBounds([48.8, 14.0], [55.0, 24.5]);
const MAX_MARKERS = 300;

// Style pinu (vector circleMarker — renderowane na canvas, nie DOM)
function pinStyle(pin) {
  const claimed = pin.isAssigned;
  const isMeeting = pin.type === "spotkanie";
  const sla = !claimed && !isMeeting && isSlaBreached(pin);
  const fresh = !claimed && !isMeeting && isFresh(pin);
  const near = !claimed && isMeeting && isMeetingNear(pin);

  let fillColor;
  if (isMeeting && !claimed) fillColor = "#3b82f6"; // niebieski — spotkanie
  else if (claimed) fillColor = "#22c55e"; // zielony — moje
  else if (sla) fillColor = "#ef4444"; // czerwony — SLA
  else if (fresh) fillColor = "#eab308"; // żółty — nowe
  else fillColor = "#f59e0b"; // amber — reszta

  const radius = near ? 9 : isMeeting ? 7 : sla ? 6 : 5;
  const weight = near ? 3 : 2;

  return {
    color: "#ffffff",
    weight,
    fillColor,
    fillOpacity: 0.9,
    radius,
  };
}

// Sortowanie "najgorętsze pierwsze" do kapowania markera (max MAX_MARKERS)
function hotSort(a, b) {
  const aM = a.type === "spotkanie" ? 0 : 1;
  const bM = b.type === "spotkanie" ? 0 : 1;
  if (aM !== bM) return aM - bM;
  if (aM === 0) return (a.meeting_date || "").localeCompare(b.meeting_date || "");
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

function FitBounds({ points }) {
  const map = useMap();
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current) return;
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points).pad(0.2), { animate: true });
      didFit.current = true;
    }
  }, [points, map]);
  return null;
}

export default function GieldaMap({ pins, geoByCode, currentUser, onClaim, claimedIds, busyId, selectedId, onSelect, flyTo }) {
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
    valid.sort(hotSort);
    return { validPins: valid.slice(0, MAX_MARKERS), fitPoints: pts };
  }, [pins, geoByCode]);

  const capped = validPins.length === MAX_MARKERS;

  return (
    <div className="relative w-full h-full">
      <style>{`
        .leaflet-container { font-family: inherit; }
        .leaflet-popup-content-wrapper { border-radius: 12px; padding: 0; overflow: hidden; }
        .leaflet-popup-content { margin: 0; width: 240px !important; }
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
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />
        <FitBounds points={fitPoints} />
        {flyTo && <Recenter center={flyTo} zoom={13} />}
        {validPins.map((pin) => {
          const g = geoByCode[pin.postal_code];
          const isSel = selectedId === pin.id;
          const style = pinStyle(pin);
          if (isSel) {
            style.weight = 4;
            style.radius = style.radius + 2;
          }
          return (
            <CircleMarker
              key={pin.id}
              center={[g.lat, g.lon]}
              pathOptions={style}
              radius={style.radius}
              eventHandlers={{ click: () => onSelect(pin) }}
              zIndexOffset={isSel ? 1000 : 0}
            >
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
            </CircleMarker>
          );
        })}
      </MapContainer>
      {capped && (
        <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur px-2.5 py-1 rounded-md shadow text-[11px] text-gray-600 z-[500]">
          Pokazano {MAX_MARKERS} najgorętszych pinów (przybliż, by zobaczyć więcej)
        </div>
      )}
    </div>
  );
}