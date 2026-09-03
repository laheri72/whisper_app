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

export const FULL_SURAH_LIST = [
  { id: 1, name: "Al-Fatihah", arabic: "الفاتحة", totalAyahs: 7 },
  { id: 2, name: "Al-Baqarah", arabic: "البقرة", totalAyahs: 286 },
  { id: 3, name: "Ali 'Imran", arabic: "آل عمران", totalAyahs: 200 },
  { id: 4, name: "An-Nisa'", arabic: "النساء", totalAyahs: 176 },
  { id: 5, name: "Al-Ma'idah", arabic: "المائدة", totalAyahs: 120 },
  { id: 6, name: "Al-An'am", arabic: "الأنعام", totalAyahs: 165 },
  { id: 7, name: "Al-A'raf", arabic: "الأعراف", totalAyahs: 206 },
  { id: 8, name: "Al-Anfal", arabic: "الأنفال", totalAyahs: 75 },
  { id: 9, name: "At-Tawbah", arabic: "التوبة", totalAyahs: 129 },
  { id: 10, name: "Yunus", arabic: "يونس", totalAyahs: 109 },
  { id: 11, name: "Hud", arabic: "هود", totalAyahs: 123 },
  { id: 12, name: "Yusuf", arabic: "يوسف", totalAyahs: 111 },
  { id: 13, name: "Ar-Ra'd", arabic: "الرعد", totalAyahs: 43 },
  { id: 14, name: "Ibrahim", arabic: "إبراهيم", totalAyahs: 52 },
  { id: 15, name: "Al-Hijr", arabic: "الحجر", totalAyahs: 99 },
  { id: 16, name: "An-Nahl", arabic: "النحل", totalAyahs: 128 },
  { id: 17, name: "Al-Isra'", arabic: "الإسراء", totalAyahs: 111 },
  { id: 18, name: "Al-Kahf", arabic: "الكهف", totalAyahs: 110 },
  { id: 19, name: "Maryam", arabic: "مريم", totalAyahs: 98 },
  { id: 20, name: "Taha", arabic: "طه", totalAyahs: 135 },
  { id: 21, name: "Al-Anbiya'", arabic: "الأنبياء", totalAyahs: 112 },
  { id: 22, name: "Al-Hajj", arabic: "الحج", totalAyahs: 78 },
  { id: 23, name: "Al-Mu'minun", arabic: "المؤمنون", totalAyahs: 118 },
  { id: 24, name: "An-Nur", arabic: "النور", totalAyahs: 64 },
  { id: 25, name: "Al-Furqan", arabic: "الفرقان", totalAyahs: 77 },
  { id: 26, name: "Ash-Shu'ara'", arabic: "الشعراء", totalAyahs: 227 },
  { id: 27, name: "An-Naml", arabic: "النمل", totalAyahs: 93 },
  { id: 28, name: "Al-Qasas", arabic: "القصص", totalAyahs: 88 },
  { id: 29, name: "Al-'Ankabut", arabic: "العنكبوت", totalAyahs: 69 },
  { id: 30, name: "Ar-Rum", arabic: "الروم", totalAyahs: 60 },
  { id: 31, name: "Luqman", arabic: "لقمان", totalAyahs: 34 },
  { id: 32, name: "As-Sajdah", arabic: "السجدة", totalAyahs: 30 },
  { id: 33, name: "Al-Ahzab", arabic: "الأحزاب", totalAyahs: 73 },
  { id: 34, name: "Saba", arabic: "سبأ", totalAyahs: 54 },
  { id: 35, name: "Fatir", arabic: "فاطر", totalAyahs: 45 },
  { id: 36, name: "Ya-Sin", arabic: "يس", totalAyahs: 83 },
  { id: 37, name: "As-Saffat", arabic: "الصافات", totalAyahs: 182 },
  { id: 38, name: "Sad", arabic: "ص", totalAyahs: 88 },
  { id: 39, name: "Az-Zumar", arabic: "الزمر", totalAyahs: 75 },
  { id: 40, name: "Ghafir", arabic: "غافر", totalAyahs: 85 },
  { id: 41, name: "Fussilat", arabic: "فصلت", totalAyahs: 54 },
  { id: 42, name: "Ash-Shura", arabic: "الشورى", totalAyahs: 53 },
  { id: 43, name: "Az-Zukhruf", arabic: "الزخرف", totalAyahs: 89 },
  { id: 44, name: "Ad-Dukhan", arabic: "الدخان", totalAyahs: 59 },
  { id: 45, name: "Al-Jathiyah", arabic: "الجاثية", totalAyahs: 37 },
  { id: 46, name: "Al-Ahqaf", arabic: "الأحقاف", totalAyahs: 35 },
  { id: 47, name: "Muhammad", arabic: "محمد", totalAyahs: 38 },
  { id: 48, name: "Al-Fath", arabic: "الفتح", totalAyahs: 29 },
  { id: 49, name: "Al-Hujurat", arabic: "الحجرات", totalAyahs: 18 },
  { id: 50, name: "Qaf", arabic: "ق", totalAyahs: 45 },
  { id: 51, name: "Adh-Dhariyat", arabic: "الذاريات", totalAyahs: 60 },
  { id: 52, name: "At-Tur", arabic: "الطور", totalAyahs: 49 },
  { id: 53, name: "An-Najm", arabic: "النجم", totalAyahs: 62 },
  { id: 54, name: "Al-Qamar", arabic: "القمر", totalAyahs: 55 },
  { id: 55, name: "Ar-Rahman", arabic: "الرحمن", totalAyahs: 78 },
  { id: 56, name: "Al-Waqi'ah", arabic: "الواقعة", totalAyahs: 96 },
  { id: 57, name: "Al-Hadid", arabic: "الحديد", totalAyahs: 29 },
  { id: 58, name: "Al-Mujadila", arabic: "المجادلة", totalAyahs: 22 },
  { id: 59, name: "Al-Hashr", arabic: "الحشر", totalAyahs: 24 },
  { id: 60, name: "Al-Mumtahanah", arabic: "الممتحنة", totalAyahs: 13 },
  { id: 61, name: "As-Saff", arabic: "الصف", totalAyahs: 14 },
  { id: 62, name: "Al-Jumu'ah", arabic: "الجمعة", totalAyahs: 11 },
  { id: 63, name: "Al-Munafiqun", arabic: "المنافقون", totalAyahs: 11 },
  { id: 64, name: "At-Taghabun", arabic: "التغابن", totalAyahs: 18 },
  { id: 65, name: "At-Talaq", arabic: "الطلاق", totalAyahs: 12 },
  { id: 66, name: "At-Tahrim", arabic: "التحريم", totalAyahs: 12 },
  { id: 67, name: "Al-Mulk", arabic: "الملك", totalAyahs: 30 },
  { id: 68, name: "Al-Qalam", arabic: "القلم", totalAyahs: 52 },
  { id: 69, name: "Al-Haqqah", arabic: "الحاقة", totalAyahs: 52 },
  { id: 70, name: "Al-Ma'arij", arabic: "المعارج", totalAyahs: 44 },
  { id: 71, name: "Nuh", arabic: "نوح", totalAyahs: 28 },
  { id: 72, name: "Al-Jinn", arabic: "الجن", totalAyahs: 28 },
  { id: 73, name: "Al-Muzzammil", arabic: "المزمل", totalAyahs: 20 },
  { id: 74, name: "Al-Muddaththir", arabic: "المدثر", totalAyahs: 56 },
  { id: 75, name: "Al-Qiyamah", arabic: "القيامة", totalAyahs: 40 },
  { id: 76, name: "Al-Insan", arabic: "الإنسان", totalAyahs: 31 },
  { id: 77, name: "Al-Mursalat", arabic: "المرسلات", totalAyahs: 50 },
  { id: 78, name: "An-Naba'", arabic: "النبأ", totalAyahs: 40 },
  { id: 79, name: "An-Nazi'at", arabic: "النازعات", totalAyahs: 46 },
  { id: 80, name: "'Abasa", arabic: "عبس", totalAyahs: 42 },
  { id: 81, name: "At-Takwir", arabic: "التكوير", totalAyahs: 29 },
  { id: 82, name: "Al-Infitar", arabic: "الانفطار", totalAyahs: 19 },
  { id: 83, name: "Al-Mutaffifin", arabic: "المطففين", totalAyahs: 36 },
  { id: 84, name: "Al-Inshiqaq", arabic: "الانشقاق", totalAyahs: 25 },
  { id: 85, name: "Al-Buruj", arabic: "البروج", totalAyahs: 22 },
  { id: 86, name: "At-Tariq", arabic: "الطارق", totalAyahs: 17 },
  { id: 87, name: "Al-A'la", arabic: "الأعلى", totalAyahs: 19 },
  { id: 88, name: "Al-Ghashiyah", arabic: "الغاشية", totalAyahs: 26 },
  { id: 89, name: "Al-Fajr", arabic: "الفجر", totalAyahs: 30 },
  { id: 90, name: "Al-Balad", arabic: "البلد", totalAyahs: 20 },
  { id: 91, name: "Ash-Shams", arabic: "الشمس", totalAyahs: 15 },
  { id: 92, name: "Al-Layl", arabic: "الليل", totalAyahs: 21 },
  { id: 93, name: "Ad-Duha", arabic: "الضحى", totalAyahs: 11 },
  { id: 94, name: "Ash-Sharh", arabic: "الشرح", totalAyahs: 8 },
  { id: 95, name: "At-Tin", arabic: "التين", totalAyahs: 8 },
  { id: 96, name: "Al-'Alaq", arabic: "العلق", totalAyahs: 19 },
  { id: 97, name: "Al-Qadr", arabic: "القدر", totalAyahs: 5 },
  { id: 98, name: "Al-Bayyinah", arabic: "البينة", totalAyahs: 8 },
  { id: 99, name: "Az-Zalzalah", arabic: "الزلزلة", totalAyahs: 8 },
  { id: 100, name: "Al-'Adiyat", arabic: "العاديات", totalAyahs: 11 },
  { id: 101, name: "Al-Qari'ah", arabic: "القارعة", totalAyahs: 11 },
  { id: 102, name: "At-Takathur", arabic: "التكاثر", totalAyahs: 8 },
  { id: 103, name: "Al-'Asr", arabic: "العصر", totalAyahs: 3 },
  { id: 104, name: "Al-Humazah", arabic: "الهمزة", totalAyahs: 9 },
  { id: 105, name: "Al-Fil", arabic: "الفيل", totalAyahs: 5 },
  { id: 106, name: "Quraysh", arabic: "قريش", totalAyahs: 4 },
  { id: 107, name: "Al-Ma'un", arabic: "الماعون", totalAyahs: 7 },
  { id: 108, name: "Al-Kawthar", arabic: "الكوثر", totalAyahs: 3 },
  { id: 109, name: "Al-Kafirun", arabic: "الكافرون", totalAyahs: 6 },
  { id: 110, name: "An-Nasr", arabic: "النصر", totalAyahs: 3 },
  { id: 111, name: "Al-Masad", arabic: "المسد", totalAyahs: 5 },
  { id: 112, name: "Al-Ikhlas", arabic: "الإخلاص", totalAyahs: 4 },
  { id: 113, name: "Al-Falaq", arabic: "الفلق", totalAyahs: 5 },
  { id: 114, name: "An-Nas", arabic: "الناس", totalAyahs: 6 }
];

export const SURAH_LIST = FULL_SURAH_LIST;
