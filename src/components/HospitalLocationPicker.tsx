'use client';

import { useEffect, useRef } from 'react';
import type * as Leaflet from 'leaflet';

type Props = {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number, longitude: number) => void;
};

const DEFAULT_CENTER: Leaflet.LatLngExpression = [15, 101];

export default function HospitalLocationPicker({ latitude, longitude, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markerRef = useRef<Leaflet.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const positionRef = useRef({ latitude, longitude });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    positionRef.current = { latitude, longitude };
  }, [latitude, longitude]);

  useEffect(() => {
    let isActive = true;
    let map: Leaflet.Map | null = null;
    let marker: Leaflet.Marker | null = null;

    async function initializeMap() {
      const leaflet = await import('leaflet');
      if (!isActive || !containerRef.current) return;

      map = leaflet.map(containerRef.current).setView(DEFAULT_CENTER, 6);
      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const placeMarker = (lat: number, lng: number) => {
        if (!map) return;
        if (!marker || !map.hasLayer(marker)) {
          marker = leaflet.marker([lat, lng], {
            draggable: true,
            icon: leaflet.divIcon({
              className: '',
              html: '<span class="hospital-map-pin" aria-hidden="true"></span>',
              iconSize: [28, 36],
              iconAnchor: [14, 34],
            }),
          }).addTo(map);
          marker.on('dragend', () => {
            const position = marker?.getLatLng();
            if (position) onChangeRef.current(position.lat, position.lng);
          });
          markerRef.current = marker;
        } else {
          marker.setLatLng([lat, lng]);
        }
      };

      map.on('click', (event: Leaflet.LeafletMouseEvent) => {
        placeMarker(event.latlng.lat, event.latlng.lng);
        onChangeRef.current(event.latlng.lat, event.latlng.lng);
      });

      mapRef.current = map;
      const position = positionRef.current;
      if (position.latitude !== null && position.longitude !== null) {
        placeMarker(position.latitude, position.longitude);
        map.setView([position.latitude, position.longitude], 15);
      }
    }

    void initializeMap();

    return () => {
      isActive = false;
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (latitude === null || longitude === null) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }
    if (!mapRef.current) return;

    const placeMarker = async () => {
      const leaflet = await import('leaflet');
      if (!mapRef.current) return;
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
        return;
      }
      markerRef.current = leaflet.marker([latitude, longitude], {
        draggable: true,
        icon: leaflet.divIcon({
          className: '',
          html: '<span class="hospital-map-pin" aria-hidden="true"></span>',
          iconSize: [28, 36],
          iconAnchor: [14, 34],
        }),
      }).addTo(mapRef.current);
      markerRef.current.on('dragend', () => {
        const position = markerRef.current?.getLatLng();
        if (position) onChangeRef.current(position.lat, position.lng);
      });
    };
    void placeMarker();
  }, [latitude, longitude]);

  return (
    <div>
      <div
        ref={containerRef}
        className="h-72 w-full rounded-lg border border-slate-300 bg-slate-100 sm:h-80"
        aria-label="แผนที่สำหรับปักหมุดสถานพยาบาล"
      />
      <style jsx global>{`
        .hospital-map-pin {
          display: block;
          width: 24px;
          height: 24px;
          border: 3px solid #fff;
          border-radius: 50% 50% 50% 0;
          background: #0f766e;
          box-shadow: 0 2px 8px rgb(15 23 42 / 35%);
          transform: rotate(-45deg);
        }
      `}</style>
    </div>
  );
}
