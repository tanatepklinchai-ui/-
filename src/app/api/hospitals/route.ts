// src/app/api/hospitals/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DEFAULT_LATITUDE = 15.1389;
const DEFAULT_LONGITUDE = 100.2755;
const SEARCH_RADIUS_METERS = 15_000;

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type Hospital = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceVal: number;
  distance: string;
  availableDates: { date: string; dateString: string; slots: string[]; fullSlots: string[] }[];
};

type AvailableDate = Hospital['availableDates'][number];

function getBangkokToday() {
  const dateParts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date());
  const partValues = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]));
  const currentDate = new Date(Date.UTC(
    Number(partValues.year),
    Number(partValues.month) - 1,
    Number(partValues.day)
  ));
  return currentDate;
}

function formatSlotDate(date: Date) {
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const deltaLat = (lat2 - lat1) * (Math.PI / 180);
  const deltaLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatDistance(distanceKm: number) {
  return distanceKm < 1
    ? `${(distanceKm * 1000).toFixed(0)} ม.`
    : `${distanceKm.toFixed(1)} กม.`;
}

function readCoordinate(value: string | null, fallback: number, min: number, max: number) {
  if (value === null) return fallback;
  if (value.trim() === '') return null;

  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max
    ? coordinate
    : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const searchQuery = searchParams.get('search');
  const latitude = readCoordinate(searchParams.get('lat'), DEFAULT_LATITUDE, -90, 90);
  const longitude = readCoordinate(searchParams.get('lng'), DEFAULT_LONGITUDE, -180, 180);

  // ตรวจสอบพารามิเตอร์ (ต้องมีอย่างใดอย่างหนึ่ง: คำค้นหา หรือ พิกัด)
  if (!searchQuery && (latitude === null || longitude === null)) {
    return NextResponse.json({ error: 'พิกัดหรือคำค้นหาไม่ถูกต้อง' }, { status: 400 });
  }

  let mappedHospitals: Hospital[] = [];
  const bangkokToday = getBangkokToday();

  try {
    if (searchQuery) {
      // โหมดที่ 1: ค้นหาจากข้อความ (พิมพ์ชื่อ)
      const dbHospitals = await prisma.hospital.findMany({
        where: {
          isActive: true,
          name: {
            contains: searchQuery,
            mode: 'insensitive' // ค้นหาแบบไม่สนใจตัวพิมพ์เล็ก/ใหญ่ (สำหรับ PostgreSQL)
          }
        },
        take: 20
      });

      mappedHospitals = dbHospitals.map(h => {
        let distanceVal = 99999;
        let distanceStr = '';
        
        // คำนวณระยะห่าง ถ้ามีพิกัดปัจจุบันส่งมาด้วย
        if (latitude !== null && longitude !== null && h.latitude !== null && h.longitude !== null) {
           distanceVal = getDistance(latitude, longitude, h.latitude, h.longitude);
           distanceStr = formatDistance(distanceVal);
        }
        
        return {
          id: h.id,
          name: h.name,
          latitude: h.latitude ?? 0,
          longitude: h.longitude ?? 0,
          distanceVal: distanceVal,
          distance: distanceStr,
          availableDates: [],
        };
      });

    } else {
      // โหมดที่ 2: ค้นหาจากพิกัด (GPS + OpenStreetMap)
      const overpassQuery = `
        [out:json][timeout:20];
        (
          nwr(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})[amenity~"^(hospital|clinic)$"];
          nwr(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})[healthcare~"^(hospital|clinic|health_post|centre)$"];
        );
        out center;
      `;
      const overpassUrl = new URL('https://overpass-api.de/api/interpreter');
      overpassUrl.searchParams.set('data', overpassQuery);

      const response = await fetch(overpassUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'PromChid/1.0 (OpenStreetMap Overpass client)',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(25_000),
      });

      if (!response.ok) {
        return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลจากแผนที่ได้' }, { status: 502 });
      }

      const data = (await response.json()) as { elements?: OverpassElement[] };
      const seenElements = new Set<string>();
      let unnamedHospitalCount = 0;
      
      mappedHospitals = (data.elements ?? []).flatMap((element) => {
        const elementKey = `${element.type}-${element.id}`;
        if (seenElements.has(elementKey)) return [];
        seenElements.add(elementKey);

        const hospitalLatitude = element.lat ?? element.center?.lat;
        const hospitalLongitude = element.lon ?? element.center?.lon;
        if (
          typeof hospitalLatitude !== 'number' ||
          typeof hospitalLongitude !== 'number' ||
          !Number.isFinite(hospitalLatitude) ||
          !Number.isFinite(hospitalLongitude)
        ) {
          return [];
        }

        const distanceVal = getDistance(
          latitude!,
          longitude!,
          hospitalLatitude,
          hospitalLongitude
        );

        return [{
          id: `osm-${element.type}-${element.id}`,
          name: element.tags?.name || `สถานพยาบาล (แห่งที่ ${++unnamedHospitalCount})`,
          latitude: hospitalLatitude,
          longitude: hospitalLongitude,
          distanceVal,
          distance: formatDistance(distanceVal),
          availableDates: []
        }];
      });
    }

    const hospitalIds = mappedHospitals.map((hospital) => hospital.id);

    if (mappedHospitals.length > 0) {
      await prisma.hospital.createMany({
        data: mappedHospitals.map(({ id, name, latitude, longitude }) => ({
          id,
          name,
          latitude,
          longitude,
        })),
        skipDuplicates: true,
      });
    }

    // Also include configured hospitals that have no matching map entry.
    const hospitalsWithSlots = await prisma.hospital.findMany({
      where: searchQuery
        ? { id: { in: hospitalIds }, isActive: true }
        : {
            isActive: true,
            OR: [
              { id: { in: hospitalIds } },
              { slots: { some: { date: { gte: bangkokToday }, isAdminDefined: true } } },
            ],
          },
      include: {
        slots: {
          where: { date: { gte: bangkokToday }, isAdminDefined: true },
          orderBy: [{ date: 'asc' }, { time: 'asc' }],
        },
      },
    });

    const now = new Date();
    const slotsByHospitalId = new Map<string, AvailableDate[]>(
      hospitalsWithSlots.map((hospital) => {
        const dateGroups = new Map<string, AvailableDate>();
        hospital.slots.filter((slot) => {
          const scheduledAt = new Date(`${slot.date.toISOString().slice(0, 10)}T${slot.time}:00+07:00`);
          return !slot.isClosed && scheduledAt > now;
        }).forEach((slot) => {
          const dateString = slot.date.toISOString().slice(0, 10);
          const group = dateGroups.get(dateString) ?? {
            date: formatSlotDate(slot.date),
            dateString,
            slots: [],
            fullSlots: [],
          };
          if (slot.booked < slot.capacity) group.slots.push(slot.time);
          else group.fullSlots.push(slot.time);
          dateGroups.set(dateString, group);
        });
        return [hospital.id, Array.from(dateGroups.values())];
      })
    );

    const activeHospitalIds = new Set(hospitalsWithSlots.map(({ id }) => id));
    const hospitals: Hospital[] = mappedHospitals.filter(({ id }) => activeHospitalIds.has(id)).map((hospital) => ({
      ...hospital,
      availableDates: slotsByHospitalId.get(hospital.id) ?? [],
    }));

    if (!searchQuery) {
      const mappedHospitalIds = new Set(hospitals.map((hospital) => hospital.id));
      for (const hospital of hospitalsWithSlots) {
        if (mappedHospitalIds.has(hospital.id)) continue;

        const availableDates = slotsByHospitalId.get(hospital.id) ?? [];
        if (availableDates.length === 0) continue;

        const hasCoordinates = hospital.latitude !== null && hospital.longitude !== null;
        const distanceVal = hasCoordinates
          ? getDistance(latitude!, longitude!, hospital.latitude!, hospital.longitude!)
          : Number.MAX_SAFE_INTEGER;
        if (hasCoordinates && distanceVal > SEARCH_RADIUS_METERS / 1000) continue;

        hospitals.push({
          id: hospital.id,
          name: hospital.name,
          latitude: hospital.latitude ?? 0,
          longitude: hospital.longitude ?? 0,
          distanceVal,
          distance: hasCoordinates ? formatDistance(distanceVal) : 'ตำแหน่งไม่ระบุ',
          availableDates,
        });
      }
    }
    
    // เรียงลำดับตามระยะทางที่ใกล้ที่สุด
    hospitals.sort((a, b) => a.distanceVal - b.distanceVal);
    
    return NextResponse.json({ hospitals });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานพยาบาล' },
      { status: 500 }
    );
  }
}