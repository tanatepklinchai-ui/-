'use client';

import { useState } from 'react';

export interface Hospital {
  id: string;
  name: string;
  distance: string;
  distanceVal: number | null;
  latitude: number | null;
  longitude: number | null;
  availableDates: { date: string; slots: string[] }[];
}

interface Props {
  onSelectHospital: (hospital: Hospital) => void;
}

export default function HospitalSearchMap({ onSelectHospital }: Props) {
  const [query, setQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);
  const [selectedDateSlot, setSelectedDateSlot] = useState<{ date: string; time: string } | null>(null);
  const [realHospitals, setRealHospitals] = useState<Hospital[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const filteredHospitals = realHospitals.filter((hospital) => hospital.name.includes(query));
  const selectedHospitalData = realHospitals.find((hospital) => hospital.id === selectedHospital);

  const handleFindNearby = () => {
    setIsLocating(true);

    if (!navigator.geolocation) {
      alert('อุปกรณ์ของคุณไม่รองรับการระบุตำแหน่ง');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(`/api/hospitals?lat=${latitude}&lng=${longitude}`);
          if (!res.ok) throw new Error('Hospital search failed');

          const data: { hospitals?: Hospital[] } = await res.json();
          setRealHospitals(data.hospitals ?? []);
          setIsDropdownOpen(true);
        } catch {
          alert('เกิดข้อผิดพลาดในการดึงข้อมูลโรงพยาบาล');
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        alert('กรุณาเปิดใช้งาน GPS และอนุญาตการเข้าถึงตำแหน่งที่ตั้งในเบราว์เซอร์');
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSelect = (hospital: Hospital) => {
    setQuery(hospital.name);
    setSelectedHospital(hospital.id);
    setSelectedDateSlot(null);
    setIsDropdownOpen(false);
    onSelectHospital(hospital);
  };

  // พิกัดสำหรับแสดงแผนที่ OpenStreetMap พร้อมปักหมุด
  const mapBbox = selectedHospitalData?.latitude != null && selectedHospitalData.longitude != null
    ? `${selectedHospitalData.longitude - 0.008}%2C${selectedHospitalData.latitude - 0.008}%2C${selectedHospitalData.longitude + 0.008}%2C${selectedHospitalData.latitude + 0.008}`
    : '100.45%2C13.70%2C100.65%2C13.85';

  const mapSrc = selectedHospitalData?.latitude != null && selectedHospitalData.longitude != null
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${mapBbox}&layer=mapnik&marker=${selectedHospitalData.latitude}%2C${selectedHospitalData.longitude}`
    : `https://www.openstreetmap.org/export/embed.html?bbox=${mapBbox}&layer=mapnik`;

  return (
    <div className="space-y-4">
      <div className="relative">
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          ค้นหาโรงพยาบาล / จุดบริการฉีดวัคซีน
        </label>
        <button
          type="button"
          onClick={handleFindNearby}
          disabled={isLocating}
          className="mb-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {isLocating ? 'กำลังค้นหา...' : 'ค้นหาโรงพยาบาลใกล้ฉัน'}
        </button>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder="พิมพ์ชื่อโรงพยาบาล เช่น ธรรมศาสตร์, ศิริราช..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 bg-white placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedHospital(null);
              }}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-sm"
            >
              ✕
            </button>
          )}
        </div>

        {/* แถบรายการค้นหาแนะนำ (Autocomplete Dropdown) */}
        {isDropdownOpen && (query.trim() !== '' || realHospitals.length > 0) && (
          <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto divide-y divide-gray-100">
            {filteredHospitals.length > 0 ? (
              filteredHospitals.map((hospital) => (
                <li
                  key={hospital.id}
                  onClick={() => handleSelect(hospital)}
                  className="p-3 hover:bg-teal-50 cursor-pointer transition flex items-start justify-between"
                >
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{hospital.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{hospital.distance}</p>
                  </div>
                  <span className="text-xs text-teal-600 bg-teal-50 px-2 py-1 rounded">เลือก</span>
                </li>
              ))
            ) : (
              <li className="p-3 text-sm text-gray-500 text-center">
                ไม่พบข้อมูลโรงพยาบาลที่ค้นหา
              </li>
            )}
          </ul>
        )}
      </div>

      {/* แผนที่แสดงตำแหน่งปักหมุด */}
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-gray-100">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center text-xs text-gray-600">
          <span>📍 ตำแหน่งบนแผนที่</span>
          {selectedHospitalData && (
            <span className="text-teal-700 font-medium">{selectedHospitalData.name}</span>
          )}
        </div>
        <div className="relative h-64 w-full">
          <iframe
            title="Hospital Map Pin"
            src={mapSrc}
            className="w-full h-full border-0"
            loading="lazy"
          />
        </div>
      </div>
      {selectedHospitalData && selectedHospitalData.availableDates.length > 0 && (
        <div className="space-y-3">
          {selectedHospitalData.availableDates.map(({ date, slots }) => (
            <div key={date} className="flex flex-wrap items-center gap-2">
              <span className="mr-2 text-sm font-medium text-gray-700">{date}</span>
              {slots.map((time) => (
                <button
                  key={`${date}-${time}`}
                  type="button"
                  onClick={() => setSelectedDateSlot({ date, time })}
                  className={`rounded border px-3 py-1.5 text-sm ${
                    selectedDateSlot?.date === date && selectedDateSlot.time === time
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : 'border-gray-300 text-gray-700 hover:border-teal-600'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}