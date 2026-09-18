// src/lib/vaccineSchedule.ts

export interface VaccineDetail {
  code: string;
  name: string;
  dose: string;
  ageCriteria: string;
  ageInMonths: number;
  description: string;
}

export const VACCINE_SCHEDULE: VaccineDetail[] = [
  // แรกเกิด
  { code: 'BCG', name: 'BCG', dose: 'เข็ม 1', ageCriteria: 'แรกเกิด', ageInMonths: 0, description: 'ป้องกันวัณโรค' },
  { code: 'HB1', name: 'Hepatitis B (HB)', dose: 'เข็ม 1', ageCriteria: 'แรกเกิด', ageInMonths: 0, description: 'ป้องกันโรคตับอักเสบบี' },

  // 2 เดือน
  { code: 'DTP-HB-HIB1', name: 'DTP-HB-Hib', dose: 'เข็ม 1', ageCriteria: '2 เดือน', ageInMonths: 2, description: 'ป้องกันคอตีบ ไอกรน บาดทะยัก ตับอักเสบบี และฮิบ (เยื่อหุ้มสมองอักเสบ)' },
  { code: 'IPV1', name: 'IPV', dose: 'เข็ม 1', ageCriteria: '2 เดือน', ageInMonths: 2, description: 'ป้องกันโปลิโอ (วัคซีนชนิดฉีด)' },
  { code: 'ROTA1', name: 'Rotavirus', dose: 'เข็ม 1', ageCriteria: '2 เดือน', ageInMonths: 2, description: 'ป้องกันโรคอุจจาระร่วงจากเชื้อโรต้าไวรัส' },

  // 4 เดือน
  { code: 'DTP-HB-HIB2', name: 'DTP-HB-Hib', dose: 'เข็ม 2', ageCriteria: '4 เดือน', ageInMonths: 4, description: 'ป้องกันคอตีบ ไอกรน บาดทะยัก ตับอักเสบบี และฮิบ (เยื่อหุ้มสมองอักเสบ)' },
  { code: 'IPV2', name: 'IPV', dose: 'เข็ม 2', ageCriteria: '4 เดือน', ageInMonths: 4, description: 'ป้องกันโปลิโอ (วัคซีนชนิดฉีด)' },
  { code: 'ROTA2', name: 'Rotavirus', dose: 'เข็ม 2', ageCriteria: '4 เดือน', ageInMonths: 4, description: 'ป้องกันโรคอุจจาระร่วงจากเชื้อโรต้าไวรัส' },

  // 6 เดือน
  { code: 'DTP-HB-HIB3', name: 'DTP-HB-Hib', dose: 'เข็ม 3', ageCriteria: '6 เดือน', ageInMonths: 6, description: 'ป้องกันคอตีบ ไอกรน บาดทะยัก ตับอักเสบบี และฮิบ (เยื่อหุ้มสมองอักเสบ)' },
  { code: 'OPV1', name: 'OPV', dose: 'เข็ม 1', ageCriteria: '6 เดือน', ageInMonths: 6, description: 'ป้องกันโปลิโอ (วัคซีนชนิดหยอด)' },
  { code: 'FLU1', name: 'Influenza', dose: 'เข็ม 1', ageCriteria: '6 เดือน', ageInMonths: 6, description: 'ป้องกันไข้หวัดใหญ่ (ฉีดปีละครั้ง)' },
  { code: 'FLU2', name: 'Influenza', dose: 'เข็ม 2', ageCriteria: '6 เดือน', ageInMonths: 6, description: 'ป้องกันไข้หวัดใหญ่ (ฉีดปีละครั้ง)' },

  // 9 เดือน
  { code: 'MMR1', name: 'MMR', dose: 'เข็ม 1', ageCriteria: '9 เดือน', ageInMonths: 9, description: 'ป้องกันหัด คางทูม หัดเยอรมัน' },

  // 12 เดือน (1 ปี)
  { code: 'JE1', name: 'JE (ไข้สมองอักเสบเจอี)', dose: 'เข็ม 1', ageCriteria: '12 เดือน', ageInMonths: 12, description: 'ป้องกันไข้สมองอักเสบเจอี' },

  // 18 เดือน (1 ปี 6 เดือน)
  { code: 'DTP4', name: 'DTP', dose: 'เข็ม 4', ageCriteria: '18 เดือน', ageInMonths: 18, description: 'ป้องกันคอตีบ ไอกรน บาดทะยัก' },
  { code: 'OPV2', name: 'OPV', dose: 'เข็ม 2', ageCriteria: '18 เดือน', ageInMonths: 18, description: 'ป้องกันโปลิโอ (วัคซีนชนิดหยอด)' },
  { code: 'MMR2', name: 'MMR', dose: 'เข็ม 2', ageCriteria: '18 เดือน', ageInMonths: 18, description: 'ป้องกันหัด คางทูม หัดเยอรมัน' },
  { code: 'JE2', name: 'JE (ไข้สมองอักเสบเจอี)', dose: 'เข็ม 2', ageCriteria: '18 เดือน', ageInMonths: 18, description: 'ป้องกันไข้สมองอักเสบเจอี' },

  // 4 ปี
  { code: 'DTP5', name: 'DTP', dose: 'เข็ม 5', ageCriteria: '4 ปี', ageInMonths: 48, description: 'ป้องกันคอตีบ ไอกรน บาดทะยัก' },
  { code: 'OPV3', name: 'OPV', dose: 'เข็ม 3', ageCriteria: '4 ปี', ageInMonths: 48, description: 'ป้องกันโปลิโอ (วัคซีนชนิดหยอด)' },
];