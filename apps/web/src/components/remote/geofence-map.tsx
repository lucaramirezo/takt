'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'

// takt token hexes (leaflet vector paths take literal colors, not CSS vars).
const SUCCESS = '#2f7d54'
const ORANGE = '#e8590c'
const NEUTRAL = '#8a8578'

export interface GeofenceMapProps {
  center: { lat: number; lng: number }
  radiusM: number
  /** Live worker fix, or null before the first GPS read. */
  worker: { lat: number; lng: number } | null
  /** Client-side zone hint; null until a fix exists. */
  inZone: boolean | null
}

function zoneColor(worker: GeofenceMapProps['worker'], inZone: boolean | null): string {
  if (!worker || inZone == null) return NEUTRAL
  return inZone ? SUCCESS : ORANGE
}

/** Keeps the geofence ring and the worker dot framed together as the worker moves. */
function FitBounds({ center, radiusM, worker }: GeofenceMapProps) {
  const map = useMap()
  const workerLat = worker?.lat
  const workerLng = worker?.lng
  useEffect(() => {
    const bounds = L.latLng(center.lat, center.lng).toBounds(radiusM * 2.6)
    if (workerLat != null && workerLng != null) bounds.extend([workerLat, workerLng])
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 17, animate: true })
  }, [map, center.lat, center.lng, radiusM, workerLat, workerLng])
  return null
}

export default function GeofenceMap({ center, radiusM, worker, inZone }: GeofenceMapProps) {
  const color = zoneColor(worker, inZone)
  const workerIcon = useMemo(
    () =>
      L.divIcon({
        className: 'takt-geo-marker',
        html: `<span class="takt-geo-dot" style="--dot:${color}"></span>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    [color],
  )

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={16}
      zoomControl={false}
      scrollWheelZoom={false}
      attributionControl={false}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
      <Circle
        center={[center.lat, center.lng]}
        radius={radiusM}
        pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.12 }}
      />
      {worker && <Marker position={[worker.lat, worker.lng]} icon={workerIcon} />}
      <FitBounds center={center} radiusM={radiusM} worker={worker} inZone={inZone} />
    </MapContainer>
  )
}
