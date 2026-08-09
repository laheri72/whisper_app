/**
 * Juz Mapping Utility for Academic Quran Portal
 * Implements exact page math:
 * - Juz 1: Pages 1 to 21
 * - Juz 2: Pages 22 to 41
 * - Juz 3: Pages 42 to 61
 * - Each subsequent Juz adds 20 pages (Juz j: start = 22 + (j-2)*20, end = 41 + (j-2)*20)
 */

export const getJuzPageRange = (juzNumber) => {
  const juz = parseInt(juzNumber, 10);
  if (isNaN(juz) || juz < 1 || juz > 30) {
    return { startPage: 1, endPage: 21 };
  }
  if (juz === 1) {
    return { startPage: 1, endPage: 21 };
  }
  const startPage = 22 + (juz - 2) * 20;
  const endPage = 41 + (juz - 2) * 20;
  return { startPage, endPage };
};

export const JUZ_LIST = Array.from({ length: 30 }, (_, index) => {
  const juzNum = index + 1;
  const range = getJuzPageRange(juzNum);
  return {
    id: juzNum,
    name: `Juz ${juzNum}`,
    arabicName: `الجزء ${juzNum}`,
    startPage: range.startPage,
    endPage: range.endPage,
    displayLabel: `Juz ${juzNum} (P. ${range.startPage} - ${range.endPage})`
  };
});

export const SURAH_LIST = [
  { id: 1, name: "Al-Fatihah", arabic: "الفاتحة", pages: "1-1", totalAyahs: 7 },
  { id: 2, name: "Al-Baqarah", arabic: "البقرة", pages: "2-49", totalAyahs: 286 },
  { id: 3, name: "Ali 'Imran", arabic: "آل عمران", pages: "50-76", totalAyahs: 200 },
  { id: 4, name: "An-Nisa'", arabic: "النساء", pages: "77-106", totalAyahs: 176 },
  { id: 5, name: "Al-Ma'idah", arabic: "المائدة", pages: "107-127", totalAyahs: 120 },
  { id: 6, name: "Al-An'am", arabic: "الأنعام", pages: "128-150", totalAyahs: 165 },
  { id: 7, name: "Al-A'raf", arabic: "الأعراف", pages: "151-176", totalAyahs: 206 },
  { id: 8, name: "Al-Anfal", arabic: "الأنفال", pages: "177-186", totalAyahs: 75 },
  { id: 9, name: "At-Tawbah", arabic: "التوبة", pages: "187-207", totalAyahs: 129 },
  { id: 10, name: "Yunus", arabic: "يونس", pages: "208-221", totalAyahs: 109 },
  { id: 11, name: "Hud", arabic: "هود", pages: "221-235", totalAyahs: 123 },
  { id: 12, name: "Yusuf", arabic: "يوسف", pages: "235-248", totalAyahs: 111 },
  { id: 13, name: "Ar-Ra'd", arabic: "الرعد", pages: "249-255", totalAyahs: 43 },
  { id: 14, name: "Ibrahim", arabic: "إبراهيم", pages: "255-261", totalAyahs: 52 },
  { id: 15, name: "Al-Hijr", arabic: "الحجر", pages: "262-267", totalAyahs: 99 },
  { id: 16, name: "An-Nahl", arabic: "النحل", pages: "267-281", totalAyahs: 128 },
  { id: 17, name: "Al-Isra'", arabic: "الإسراء", pages: "282-293", totalAyahs: 111 },
  { id: 18, name: "Al-Kahf", arabic: "الكهف", pages: "293-304", totalAyahs: 110 },
  { id: 19, name: "Maryam", arabic: "مريم", pages: "305-312", totalAyahs: 98 },
  { id: 20, name: "Taha", arabic: "طه", pages: "312-321", totalAyahs: 135 },
  { id: 21, name: "Al-Anbiya'", arabic: "الأنبياء", pages: "322-331", totalAyahs: 112 },
  { id: 22, name: "Al-Hajj", arabic: "الحج", pages: "332-341", totalAyahs: 78 },
  { id: 23, name: "Al-Mu'minun", arabic: "المؤمنون", pages: "342-349", totalAyahs: 118 },
  { id: 24, name: "An-Nur", arabic: "النور", pages: "350-359", totalAyahs: 64 },
  { id: 25, name: "Al-Furqan", arabic: "الفرقان", pages: "359-366", totalAyahs: 77 },
  { id: 26, name: "Ash-Shu'ara'", arabic: "الشعراء", pages: "367-376", totalAyahs: 227 },
  { id: 27, name: "An-Naml", arabic: "النمل", pages: "377-385", totalAyahs: 93 },
  { id: 28, name: "Al-Qasas", arabic: "القصص", pages: "385-396", totalAyahs: 88 },
  { id: 29, name: "Al-'Ankabut", arabic: "العنكبوت", pages: "396-404", totalAyahs: 69 },
  { id: 30, name: "Ar-Rum", arabic: "الروم", pages: "404-410", totalAyahs: 60 },
  { id: 36, name: "Ya-Sin", arabic: "يس", pages: "440-445", totalAyahs: 83 },
  { id: 55, name: "Ar-Rahman", arabic: "الرحمن", pages: "531-534", totalAyahs: 78 },
  { id: 67, name: "Al-Mulk", arabic: "الملك", pages: "562-564", totalAyahs: 30 },
  { id: 112, name: "Al-Ikhlas", arabic: "الإخلاص", pages: "604-604", totalAyahs: 4 },
  { id: 113, name: "Al-Falaq", arabic: "الفلق", pages: "604-604", totalAyahs: 5 },
  { id: 114, name: "An-Nas", arabic: "الناس", pages: "604-604", totalAyahs: 6 }
];
