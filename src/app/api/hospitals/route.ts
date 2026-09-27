// src/app/api/hospitals/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DEFAULT_LATITUDE = 15.1389;
const DEFAULT_LONGITUDE = 100.2755;
const SEARCH_RADIUS_METERS = 15_000;
const SLOT_TIMES = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00'];
const SLOT_CAPACITY = 10;

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
  availableDates: { date: string; dateString: string; slots: string[] }[];
};

function getUpcomingBusinessDates() {
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
  const businessDates: Date[] = [];

  while (businessDates.length < 3) {
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    const dayOfWeek = currentDate.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDates.push(new Date(currentDate));
    }
  }

  return businessDates;
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
  const latitude = readCoordinate(searchParams.get('lat'), DEFAULT_LATITUDE, -90, 90);
  const longitude = readCoordinate(searchParams.get('lng'), DEFAULT_LONGITUDE, -180, 180);

  if (latitude === null || longitude === null) {
    return NextResponse.json({ error: 'พิกัดไม่ถูกต้อง' }, { status: 400 });
  }

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

  try {
    const response = await fetch(overpassUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'PromChid/1.0 (OpenStreetMap Overpass client)',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'ไม่สามารถดึงข้อมูลจากแผนที่ OpenStreetMap ได้' },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { elements?: OverpassElement[] };
    const seenElements = new Set<string>();
    let unnamedHospitalCount = 0;
    const mappedHospitals = (data.elements ?? []).flatMap((element) => {
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
        latitude,
        longitude,
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
      }];
    });

    if (mappedHospitals.length === 0) {
      return NextResponse.json({ hospitals: [] });
    }

    const businessDates = getUpcomingBusinessDates();
    const hospitalIds = mappedHospitals.map((hospital) => hospital.id);

    await prisma.$transaction(async (transaction) => {
      await transaction.hospital.createMany({
        data: mappedHospitals.map(({ id, name, latitude, longitude }) => ({
          id,
          name,
          latitude,
          longitude,
        })),
        skipDuplicates: true,
      });

      await transaction.hospitalSlot.createMany({
        data: mappedHospitals.flatMap(({ id }) =>
          businessDates.flatMap((date) =>
            SLOT_TIMES.map((time) => ({
              hospitalId: id,
              date,
              time,
              capacity: SLOT_CAPACITY,
            }))
          )
        ),
        skipDuplicates: true,
      });
    });

    const hospitalsWithSlots = await prisma.hospital.findMany({
      where: { id: { in: hospitalIds } },
      include: {
        slots: {
          where: { date: { in: businessDates } },
          orderBy: [{ date: 'asc' }, { time: 'asc' }],
        },
      },
    });
    const slotsByHospitalId = new Map(hospitalsWithSlots.map((hospital) => {
      const dateGroups = new Map<string, { date: string; dateString: string; slots: string[] }>();
      hospital.slots.filter((slot) => !slot.isClosed && slot.booked < slot.capacity).forEach((slot) => {
        const dateString = slot.date.toISOString().slice(0, 10);
        const group = dateGroups.get(dateString) ?? {
          date: formatSlotDate(slot.date),
          dateString,
          slots: [],
        };
        group.slots.push(slot.time);
        dateGroups.set(dateString, group);
      });
      return [hospital.id, Array.from(dateGroups.values())];
    }));

    const hospitals: Hospital[] = mappedHospitals.map((hospital) => ({
      ...hospital,
      availableDates: slotsByHospitalId.get(hospital.id) ?? [],
    }));
    hospitals.sort((a, b) => a.distanceVal - b.distanceVal);
    return NextResponse.json({ hospitals });
  } catch {
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลแผนที่' },
      { status: 502 }
    );
  }
}