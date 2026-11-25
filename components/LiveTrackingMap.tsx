import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import {
  Navigation,
  Loader2,
  AlertCircle,
  RefreshCw,
  SignalHigh,
  X,
  MapPin,
  WifiOff,
} from 'lucide-react';
import { Location, Grievance, IssueStatus } from '../types';

interface LiveTrackingMapProps {
  mode: 'picker' | 'viewer';
  initialLocation?: Location | null;
  onLocationSelect?: (loc: Location) => void;
  grievances?: Grievance[];
  selectedGrievanceId?: string | null;
  onGrievanceClick?: (g: Grievance) => void;
  focusLocation?: Location | null;
  className?: string;
}

const DEFAULT_CENTER: [number, number] = [13.0827, 80.2707]; // Chennai default

function isValidCoords(lat?: number, lng?: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function createPinIcon(colorHex: string, active = false): L.DivIcon {
  const size = active ? 36 : 30;
  return L.divIcon({
    className: 'civic-osm-marker',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${colorHex};border:3px solid #ffffff;box-shadow:0 6px 16px rgba(15,23,42,0.35);color:#ffffff;">
      <svg xmlns="http://www.w3.org/2000/svg" width="${active ? 18 : 15}" height="${active ? 18 : 15}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 4],
  });
}

function createUserPulseIcon(): L.DivIcon {
  return L.divIcon({
    className: 'civic-user-pulse',
    html: `<div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;border-radius:9999px;background:#0D9488;opacity:0.25;"></div>
      <div style="width:12px;height:12px;border-radius:9999px;background:#0D9488;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const MapController: React.FC<{
  center: [number, number];
  zoom?: number;
  shouldFly?: boolean;
}> = ({ center, zoom, shouldFly }) => {
  const map = useMap();

  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(t);
  }, [map]);

  useEffect(() => {
    if (shouldFly && isValidCoords(center[0], center[1])) {
      map.flyTo(center, zoom || map.getZoom(), { duration: 1.0 });
    }
  }, [center[0], center[1], zoom, shouldFly, map]);

  return null;
};

const PickerEvents: React.FC<{
  onPick: (lat: number, lng: number) => void;
}> = ({ onPick }) => {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  mode,
  initialLocation,
  onLocationSelect,
  grievances = [],
  selectedGrievanceId,
  onGrievanceClick,
  focusLocation,
  className = 'h-[380px]',
}) => {
  const initialCoords: [number, number] = useMemo(() => {
    if (initialLocation && isValidCoords(initialLocation.latitude, initialLocation.longitude)) {
      return [initialLocation.latitude, initialLocation.longitude];
    }
    if (focusLocation && isValidCoords(focusLocation.latitude, focusLocation.longitude)) {
      return [focusLocation.latitude, focusLocation.longitude];
    }
    const firstValid = grievances.find((g) => isValidCoords(g.location?.latitude, g.location?.longitude));
    if (mode === 'viewer' && firstValid) {
      return [firstValid.location.latitude, firstValid.location.longitude];
    }
    return DEFAULT_CENTER;
  }, []);

  const [pickedPos, setPickedPos] = useState<[number, number]>(
    initialLocation && isValidCoords(initialLocation.latitude, initialLocation.longitude)
      ? [initialLocation.latitude, initialLocation.longitude]
      : DEFAULT_CENTER
  );
  const [flyTarget, setFlyTarget] = useState<{ coords: [number, number]; zoom: number } | null>(null);
  const [userGpsPos, setUserGpsPos] = useState<[number, number] | null>(null);

  const [address, setAddress] = useState<string>(initialLocation?.address || '');
  const [geocoding, setGeocoding] = useState(false);
  const [gpsSyncing, setGpsSyncing] = useState(false);
  const [gpsError, setGpsError] = useState<'PERMISSION_DENIED' | 'TIMEOUT' | 'POSITION_UNAVAILABLE' | null>(null);

  const [tileErrorCount, setTileErrorCount] = useState(0);
  const [tileKey, setTileKey] = useState(0);
  const pickerMarkerRef = useRef<L.Marker | null>(null);

  // Sync focusLocation changes in viewer mode
  useEffect(() => {
    if (mode === 'viewer' && focusLocation && isValidCoords(focusLocation.latitude, focusLocation.longitude)) {
      setFlyTarget({ coords: [focusLocation.latitude, focusLocation.longitude], zoom: 15 });
    }
  }, [mode, focusLocation?.latitude, focusLocation?.longitude]);

  // Reverse geocode via free OpenStreetMap Nominatim API
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      setGeocoding(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
          { headers: { 'Accept-Language': 'en' } }
        );
        if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
        const data = await res.json();
        const displayAddr = data.display_name || `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`;
        const addrObj = data.address || {};
        const area =
          addrObj.suburb ||
          addrObj.neighbourhood ||
          addrObj.village ||
          addrObj.town ||
          addrObj.city_district ||
          addrObj.city ||
          'Municipal Ward';
        const district = addrObj.state_district || addrObj.county || addrObj.city || '';
        const village = addrObj.village || addrObj.suburb || addrObj.neighbourhood || '';
        const taluk = addrObj.county || addrObj.town || '';

        setAddress(displayAddr);
        onLocationSelect?.({
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          address: displayAddr,
          area,
          village,
          taluk,
          district,
        });
      } catch {
        const fallbackAddr = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
        setAddress(fallbackAddr);
        onLocationSelect?.({
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          address: fallbackAddr,
          area: 'Selected Map Coordinates',
        });
      } finally {
        setGeocoding(false);
      }
    },
    [onLocationSelect]
  );

  const handlePickCoordinates = useCallback(
    (lat: number, lng: number, shouldFly = false) => {
      setPickedPos([lat, lng]);
      if (shouldFly) {
        setFlyTarget({ coords: [lat, lng], zoom: 16 });
      }
      reverseGeocode(lat, lng);
    },
    [reverseGeocode]
  );

  // Initialize picker location once on mount if none provided
  useEffect(() => {
    if (mode === 'picker' && !initialLocation) {
      onLocationSelect?.({
        latitude: DEFAULT_CENTER[0],
        longitude: DEFAULT_CENTER[1],
        address: 'Click map or drag marker to refine exact location',
        area: 'Chennai',
        district: 'Chennai',
      });
    }
  }, []);

  const locateMe = useCallback(
    (isManual = true) => {
      if (!navigator.geolocation) {
        if (isManual) setGpsError('POSITION_UNAVAILABLE');
        return;
      }
      setGpsError(null);
      setGpsSyncing(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserGpsPos([latitude, longitude]);
          setGpsSyncing(false);
          if (mode === 'picker') {
            handlePickCoordinates(latitude, longitude, true);
          } else {
            setFlyTarget({ coords: [latitude, longitude], zoom: 15 });
          }
        },
        (err) => {
          setGpsSyncing(false);
          if (!isManual && err.code === 1) return;
          if (err.code === 1) setGpsError('PERMISSION_DENIED');
          else if (err.code === 3) setGpsError('TIMEOUT');
          else setGpsError('POSITION_UNAVAILABLE');
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    },
    [mode, handlePickCoordinates]
  );

  const pickerIcon = useMemo(() => createPinIcon('#0D9488', true), []);
  const userIcon = useMemo(() => createUserPulseIcon(), []);

  const validGrievances = useMemo(
    () => grievances.filter((g) => isValidCoords(g.location?.latitude, g.location?.longitude)),
    [grievances]
  );

  const hasTileIssue = tileErrorCount >= 4;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner ${className}`}
    >
      <MapContainer
        center={flyTarget ? flyTarget.coords : initialCoords}
        zoom={mode === 'picker' ? 14 : 11}
        zoomControl={false}
        scrollWheelZoom={true}
        className="w-full h-full z-10"
      >
        <TileLayer
          key={tileKey}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          eventHandlers={{
            tileerror: () => setTileErrorCount((c) => c + 1),
            load: () => setTileErrorCount(0),
          }}
        />
        <ZoomControl position="bottomright" />
        <MapController
          center={flyTarget ? flyTarget.coords : initialCoords}
          zoom={flyTarget?.zoom}
          shouldFly={Boolean(flyTarget)}
        />

        {mode === 'picker' && (
          <>
            <PickerEvents onPick={(lat, lng) => handlePickCoordinates(lat, lng, false)} />
            <Marker
              ref={pickerMarkerRef}
              position={pickedPos}
              draggable={true}
              icon={pickerIcon}
              eventHandlers={{
                dragend: () => {
                  const marker = pickerMarkerRef.current;
                  if (marker) {
                    const { lat, lng } = marker.getLatLng();
                    handlePickCoordinates(lat, lng, false);
                  }
                },
              }}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-bold text-slate-900">Selected Complaint Location</p>
                  <p className="text-slate-600 mt-0.5">
                    {pickedPos[0].toFixed(5)}, {pickedPos[1].toFixed(5)}
                  </p>
                  <p className="text-[11px] text-teal-700 mt-1">Drag marker or click map to adjust</p>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {mode === 'viewer' &&
          validGrievances.map((g) => {
            const isSelected = selectedGrievanceId === g.id;
            const color =
              g.status === IssueStatus.RESOLVED
                ? '#059669'
                : g.priority === 'Critical'
                ? '#DC2626'
                : g.status === IssueStatus.ESCALATED
                ? '#D97706'
                : '#0B1F3A';
            return (
              <Marker
                key={g.id}
                position={[g.location.latitude, g.location.longitude]}
                icon={createPinIcon(color, isSelected)}
                eventHandlers={{
                  click: () => onGrievanceClick?.(g),
                }}
              >
                <Popup>
                  <div className="text-xs space-y-1 max-w-[220px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-teal-700">{g.id}</span>
                      <span className="font-semibold text-slate-500">{g.status}</span>
                    </div>
                    <p className="font-bold text-slate-900">{g.title}</p>
                    <p className="text-[11px] text-slate-600">
                      {g.category} • Priority: {g.priority}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {g.location.address || g.location.area || g.location.district}
                    </p>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {userGpsPos && (
          <Marker position={userGpsPos} icon={userIcon}>
            <Popup>
              <span className="text-xs font-semibold">Your Current GPS Position</span>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Top-Left Controls Overlay */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 max-w-[85%] sm:max-w-xs pointer-events-none">
        <div className="flex flex-wrap gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => locateMe(true)}
            disabled={gpsSyncing}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs shadow-md flex items-center gap-1.5 transition-all border ${
              gpsSyncing
                ? 'bg-teal-600 text-white border-teal-500 cursor-wait'
                : gpsError
                ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                : 'bg-white text-navy-900 border-slate-200 hover:bg-navy-900 hover:text-white'
            }`}
          >
            {gpsSyncing ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Detecting GPS...
              </>
            ) : gpsError ? (
              <>
                <RefreshCw size={14} /> Retry GPS
              </>
            ) : (
              <>
                <Navigation size={14} /> {mode === 'picker' ? 'Use My Location' : 'Center on Me'}
              </>
            )}
          </button>

          {mode === 'picker' && (
            <span className="px-3 py-2 rounded-xl bg-navy-900/90 text-white text-[11px] font-mono shadow-md flex items-center gap-1.5">
              <MapPin size={12} className="text-teal-400" />
              {pickedPos[0].toFixed(4)}, {pickedPos[1].toFixed(4)}
            </span>
          )}
        </div>

        {mode === 'picker' && (address || geocoding) && (
          <div className="pointer-events-auto bg-white/95 backdrop-blur-sm px-3.5 py-2.5 rounded-xl shadow-md border border-slate-200 text-xs text-slate-700">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block">
              Click map or drag pin to move
            </span>
            {geocoding ? (
              <span className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Loader2 size={11} className="animate-spin" /> Looking up street address...
              </span>
            ) : (
              <p className="text-[11px] font-medium line-clamp-2 mt-0.5">{address}</p>
            )}
          </div>
        )}

        {gpsError && (
          <div className="pointer-events-auto bg-white/95 backdrop-blur-sm p-3 rounded-xl border border-amber-200 shadow-md flex items-start gap-2.5 text-xs">
            {gpsError === 'PERMISSION_DENIED' ? (
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
            ) : (
              <SignalHigh size={16} className="text-amber-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-[11px] text-slate-600">
              <p className="font-bold text-slate-800">
                {gpsError === 'PERMISSION_DENIED'
                  ? 'Location permission blocked'
                  : gpsError === 'TIMEOUT'
                  ? 'GPS timed out'
                  : 'GPS unavailable'}
              </p>
              <p>Click directly on the OpenStreetMap or drag the marker to pick your location.</p>
            </div>
            <button
              type="button"
              onClick={() => setGpsError(null)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Dismiss GPS message"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {hasTileIssue && (
          <div className="pointer-events-auto bg-amber-50/95 border border-amber-300 rounded-xl p-3 shadow-md text-[11px] text-amber-900 flex items-start gap-2">
            <WifiOff size={15} className="shrink-0 mt-0.5 text-amber-700" />
            <div className="flex-1">
              <p className="font-bold">OpenStreetMap tiles failed to load</p>
              <p>Check your connection or retry. Coordinates and manual address entry still work.</p>
              <button
                type="button"
                onClick={() => {
                  setTileErrorCount(0);
                  setTileKey((k) => k + 1);
                }}
                className="mt-1.5 px-2.5 py-1 rounded-lg bg-amber-700 text-white font-bold text-[10px]"
              >
                Retry Map Tiles
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveTrackingMap;
