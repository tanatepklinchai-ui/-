'use client';

import { useState } from 'react';

export interface Hospital {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

// รายชื่อโรงพยาบาลแนะนำเบื้องต้น
const HOSPITALS_DATABASE: Hospital[] = [
  { id: '1', name: 'โรงพยาบาลธรรมศาสตร์เฉลิมพระเกียรติ', address: 'อ.คลองหลวง จ.ปทุมธานี', lat: 14.0754, lng: 100.6094 },
  { id: '2', name: 'โรงพยาบาลปทุมธานี', address: 'อ.เมือง จ.ปทุมธานี', lat: 14.0205, lng: 100.5284 },
  { id: '3', name: 'โรงพยาบาลจุฬาลงกรณ์ สภากาชาดไทย', address: 'เขตปทุมวัน กรุงเทพฯ', lat: 13.7317, lng: 100.5348 },
  { id: '4', name: 'โรงพยาบาลศิริราช', address: 'เขตบางกอกน้อย กรุงเทพฯ', lat: 13.7578, lng: 100.4854 },
  { id: '5', name: 'โรงพยาบาลราชวิถี', address: 'เขตราชเทวี กรุงเทพฯ', lat: 13.7663, lng: 100.5372 },
  { id: '6', name: 'โรงพยาบาลภูมิพลอดุลยเดช', address: 'เขตสายไหม กรุงเทพฯ', lat: 13.9103, lng: 100.6225 },
];

interface Props {
  onSelectHospital: (hospital: Hospital) => void;
}

export default function HospitalSearchMap({ onSelectHospital }: Props) {
  const [query, setQuery] = useState('');
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // กรองรายชื่อโรงพยาบาลตามคำค้นหา
  const filteredHospitals = HOSPITALS_DATABASE.filter(
    (h) => h.name.includes(query) || h.address.includes(query)
  );

  const handleSelect = (hospital: Hospital) => {
    setQuery(hospital.name);
    setSelectedHospital(hospital);
    setIsDropdownOpen(false);
    onSelectHospital(hospital);
  };

  // พิกัดสำหรับแสดงแผนที่ OpenStreetMap พร้อมปักหมุด
  const mapBbox = selectedHospital
    ? `${selectedHospital.lng - 0.008}%2C${selectedHospital.lat - 0.008}%2C${selectedHospital.lng + 0.008}%2C${selectedHospital.lat + 0.008}`
    : '100.45%2C13.70%2C100.65%2C13.85';

  const mapSrc = selectedHospital
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${mapBbox}&layer=mapnik&marker=${selectedHospital.lat}%2C${selectedHospital.lng}`
    : `https://www.openstreetmap.org/export/embed.html?bbox=${mapBbox}&layer=mapnik`;

  return (
    <div className="space-y-4">
      <div className="relative">
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          ค้นหาโรงพยาบาล / จุดบริการฉีดวัคซีน
        </label>
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
        {isDropdownOpen && query.trim() !== '' && (
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
                    <p className="text-xs text-gray-500 mt-0.5">{hospital.address}</p>
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
          {selectedHospital && (
            <span className="text-teal-700 font-medium">{selectedHospital.name}</span>
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
    </div>
  );
}