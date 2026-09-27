// src/app/api/hospitals/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// สูตรคำนวณระยะทาง GPS (กิโลเมตร)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');

    // ดึงโรงพยาบาลพร้อมคิวที่เปิดรับในอนาคต
    const hospitals = await prisma.hospital.findMany({
      include: {
        slots: {
          where: { date: { gte: new Date(new Date().setHours(0,0,0,0)) } },
          orderBy: [{ date: 'asc' }, { time: 'asc' }]
        }
      }
    });

    const formattedHospitals = hospitals.map(h => {
      let distanceVal = null;
      let distanceStr = 'ไม่ทราบระยะทาง';
      
      // คำนวณระยะทางหากมีการเปิด GPS และ รพ. มีการระบุพิกัดไว้
      if (lat && lng && h.latitude && h.longitude) {
        distanceVal = getDistance(lat, lng, h.latitude, h.longitude);
        distanceStr = distanceVal < 1 ? `${(distanceVal * 1000).toFixed(0)} ม.` : `${distanceVal.toFixed(1)} กม.`;
      }

      // กรองเฉพาะคิวที่ยังว่าง (ถูกจอง < ความจุ)
      const availableSlots = h.slots.filter(s => s.booked < s.capacity);
      
      // จัดกลุ่มคิวตามวันที่
      const dateMap = new Map();
      availableSlots.forEach(slot => {
        const dateStr = slot.date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
        if (!dateMap.has(dateStr)) dateMap.set(dateStr, []);
        dateMap.get(dateStr).push(slot.time);
      });

      return {
        id: h.id,
        name: h.name,
        latitude: h.latitude,
        longitude: h.longitude,
        distanceVal,
        distance: distanceStr,
        availableDates: Array.from(dateMap, ([date, slots]) => ({ date, slots }))
      };
    });

    // เรียงลำดับจากใกล้ที่สุดไปไกลที่สุด
    if (lat && lng) {
      formattedHospitals.sort((a, b) => (a.distanceVal || 9999) - (b.distanceVal || 9999));
    }

    // ส่งกลับเฉพาะโรงพยาบาลที่มีคิวว่าง
    return NextResponse.json({ hospitals: formattedHospitals.filter(h => h.availableDates.length > 0) });
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: 500 });
  }
}