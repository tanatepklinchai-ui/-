export function calculateAgeDisplay(birthDateInput: string | Date | null | undefined): string {
  if (!birthDateInput) return '-';
  const birthDate = new Date(birthDateInput);
  const today = new Date();

  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  const days = today.getDate() - birthDate.getDate();

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0) return 'แรกเกิด';
  if (years < 4) {
    return `${years} ปี ${months} เดือน`;
  }
  return `${years} ปี`;
}