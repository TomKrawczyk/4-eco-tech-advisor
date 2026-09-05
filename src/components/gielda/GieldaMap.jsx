import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { isMeetingNear } from "@/lib/gieldaData";
import GieldaPinCard from "./GieldaPinCard";

const POLAND_CENTER = [52.1, 19.3];
const POLAND_MAX_BOUNDS = L.latLngBounds([48.8, 14.0], [55.0, 24.5]);

function pinIcon(pin) {
  const claimed = pin.isAssigned;
  const isMeeting = pin.type === "spotkanie";
  const sla = !claimed && !isMeeting && (Date.now() - new Date(pin.assigned_at || pin.updated_date || pin.created_date || Date.now()).getTime() > 24 * 60 * 60 * 1000);
  const fresh = !claimed && !isMeeting && (Date.now() - new Date(pin.updated_date || pin.created_date || Date.now()).getTime() < 5 * 60 * 1000);
  const near = !claimed && isMeetingNear(pin);

  let bg, shape;
  if (isMeeting && !claimed) {
    bg = "#3b82f6"; // niebieski romb
    shape = "rotate-45";
  } else if (claimed) {
    bg = "#22c55e"; // zielony
    shape = "";
  } else if (sla) {
    bg = "#ef4444"; // czerwony
    shape = "";
  } else {
    bg = "#eab308"; // żółty
    shape = "";
  }

  const pulse = (isMeeting ? near : fresh) ? "gielda-pulse" : "";
  const diamond = shape === "rotate-45" ? "rotate(45deg)" : "rotate(0deg)";
  const size = shape === "rotate-45" ? 18 : 16;

  return L.divIcon({
    className: "gielda-pin-icon",
    html: `<div class="${pulse}" style="width:${size}px;height:${size}px;border-radius:${shape === "rotate-45" ? "3px" : "50%"};background:${bg};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4);transform:${diamond};"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom ?? map.getZoom(), { animate: true });
  }, [center, zoom, map]);
  return null;
}

function FitBounds({ pins, selectedId, geoByCode }) {
  const map = useMap();
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current) return;
    const pts = pins
      .map((p) => geoByCode[p.postal_code])
      .filter(Boolean)
      .map((g) => [g.lat, g.lon]);
    if (pts.length > 0) {
      map.fitBounds(L.latLngBounds(pts).pad(0.2), { animate: true });
      didFit.current = true;
    }
  }, [pins, geoByCode, map]);
  return null;
}

export default function GieldaMap({ pins, geoByCode, currentUser, onClaim, claimedIds, busyId, selectedId, onSelect, flyTo }) {
  const validPins = pins.filter((p) => {
    const g = geoByCode[p.postal_code];
    return g && typeof g.lat === "number" && typeof g.lon === "number";
  });

  return (
    <div className="relative w-full h-full">
      <style>{`
        .gielda-pin-icon { background: transparent; border: none; }
        .gielda-pulse { animation: gielda-pulse-anim 1.5s ease-in-out infinite; }
        @keyframes gielda-pulse-anim {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.7; }
        }
        .gielda-pulse[style*="rotate(45deg)"] { animation: gielda-pulse-rot 1.5s ease-in-out infinite; }
        @keyframes gielda-pulse-rot {
          0%, 100% { transform: rotate(45deg) scale(1); opacity: 1; }
          50% { transform: rotate(45deg) scale(1.4); opacity: 0.7; }
        }
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
        className="w-full h-full z-0"
        style={{ background: "#aadaff" }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />
        <FitBounds pins={validPins} geoByCode={geoByCode} selectedId={selectedId} />
        {flyTo && <Recenter center={flyTo} zoom={13} />}
        {validPins.map((pin) => {
          const g = geoByCode[pin.postal_code];
          const isSel = selectedId === pin.id;
          return (
            <Marker
              key={pin.id}
              position={[g.lat, g.lon]}
              icon={pinIcon(pin)}
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
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}