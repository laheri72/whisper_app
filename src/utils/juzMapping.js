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
  { id: 1, name: "Al-Fatihah", arabic: "الفاتحة", totalAyahs: 7, startPage: 1, endPage: 1 },
  { id: 2, name: "Al-Baqarah", arabic: "البقرة", totalAyahs: 286, startPage: 2, endPage: 49 },
  { id: 3, name: "Ali 'Imran", arabic: "آل عمران", totalAyahs: 200, startPage: 50, endPage: 76 },
  { id: 4, name: "An-Nisa'", arabic: "النساء", totalAyahs: 176, startPage: 77, endPage: 106 },
  { id: 5, name: "Al-Ma'idah", arabic: "المائدة", totalAyahs: 120, startPage: 107, endPage: 127 },
  { id: 6, name: "Al-An'am", arabic: "الأنعام", totalAyahs: 165, startPage: 128, endPage: 150 },
  { id: 7, name: "Al-A'raf", arabic: "الأعراف", totalAyahs: 206, startPage: 151, endPage: 176 },
  { id: 8, name: "Al-Anfal", arabic: "الأنفال", totalAyahs: 75, startPage: 177, endPage: 186 },
  { id: 9, name: "At-Tawbah", arabic: "التوبة", totalAyahs: 129, startPage: 187, endPage: 207 },
  { id: 10, name: "Yunus", arabic: "يونس", totalAyahs: 109, startPage: 208, endPage: 221 },
  { id: 11, name: "Hud", arabic: "هود", totalAyahs: 123, startPage: 221, endPage: 235 },
  { id: 12, name: "Yusuf", arabic: "يوسف", totalAyahs: 111, startPage: 235, endPage: 248 },
  { id: 13, name: "Ar-Ra'd", arabic: "الرعد", totalAyahs: 43, startPage: 249, endPage: 255 },
  { id: 14, name: "Ibrahim", arabic: "إبراهيم", totalAyahs: 52, startPage: 255, endPage: 261 },
  { id: 15, name: "Al-Hijr", arabic: "الحجر", totalAyahs: 99, startPage: 262, endPage: 267 },
  { id: 16, name: "An-Nahl", arabic: "النحل", totalAyahs: 128, startPage: 267, endPage: 281 },
  { id: 17, name: "Al-Isra'", arabic: "الإسراء", totalAyahs: 111, startPage: 282, endPage: 293 },
  { id: 18, name: "Al-Kahf", arabic: "الكهف", totalAyahs: 110, startPage: 293, endPage: 304 },
  { id: 19, name: "Maryam", arabic: "مريم", totalAyahs: 98, startPage: 305, endPage: 312 },
  { id: 20, name: "Taha", arabic: "طه", totalAyahs: 135, startPage: 312, endPage: 321 },
  { id: 21, name: "Al-Anbiya'", arabic: "الأنبياء", totalAyahs: 112, startPage: 322, endPage: 331 },
  { id: 22, name: "Al-Hajj", arabic: "الحج", totalAyahs: 78, startPage: 332, endPage: 341 },
  { id: 23, name: "Al-Mu'minun", arabic: "المؤمنون", totalAyahs: 118, startPage: 342, endPage: 349 },
  { id: 24, name: "An-Nur", arabic: "النور", totalAyahs: 64, startPage: 350, endPage: 359 },
  { id: 25, name: "Al-Furqan", arabic: "الفرقان", totalAyahs: 77, startPage: 359, endPage: 366 },
  { id: 26, name: "Ash-Shu'ara'", arabic: "الشعراء", totalAyahs: 227, startPage: 367, endPage: 376 },
  { id: 27, name: "An-Naml", arabic: "النمل", totalAyahs: 93, startPage: 377, endPage: 385 },
  { id: 28, name: "Al-Qasas", arabic: "القصص", totalAyahs: 88, startPage: 385, endPage: 396 },
  { id: 29, name: "Al-'Ankabut", arabic: "العنكبوت", totalAyahs: 69, startPage: 396, endPage: 404 },
  { id: 30, name: "Ar-Rum", arabic: "الروم", totalAyahs: 60, startPage: 404, endPage: 410 },
  { id: 31, name: "Luqman", arabic: "لقمان", totalAyahs: 34, startPage: 411, endPage: 414 },
  { id: 32, name: "As-Sajdah", arabic: "السجدة", totalAyahs: 30, startPage: 415, endPage: 417 },
  { id: 33, name: "Al-Ahzab", arabic: "الأحزاب", totalAyahs: 73, startPage: 418, endPage: 427 },
  { id: 34, name: "Saba", arabic: "سبأ", totalAyahs: 54, startPage: 428, endPage: 434 },
  { id: 35, name: "Fatir", arabic: "فاطر", totalAyahs: 45, startPage: 434, endPage: 440 },
  { id: 36, name: "Ya-Sin", arabic: "يس", totalAyahs: 83, startPage: 440, endPage: 445 },
  { id: 37, name: "As-Saffat", arabic: "الصافات", totalAyahs: 182, startPage: 446, endPage: 452 },
  { id: 38, name: "Sad", arabic: "ص", totalAyahs: 88, startPage: 453, endPage: 458 },
  { id: 39, name: "Az-Zumar", arabic: "الزمر", totalAyahs: 75, startPage: 458, endPage: 467 },
  { id: 40, name: "Ghafir", arabic: "غافر", totalAyahs: 85, startPage: 467, endPage: 476 },
  { id: 41, name: "Fussilat", arabic: "فصلت", totalAyahs: 54, startPage: 477, endPage: 482 },
  { id: 42, name: "Ash-Shura", arabic: "الشورى", totalAyahs: 53, startPage: 483, endPage: 489 },
  { id: 43, name: "Az-Zukhruf", arabic: "الزخرف", totalAyahs: 89, startPage: 489, endPage: 495 },
  { id: 44, name: "Ad-Dukhan", arabic: "الدخان", totalAyahs: 59, startPage: 496, endPage: 498 },
  { id: 45, name: "Al-Jathiyah", arabic: "الجاثية", totalAyahs: 37, startPage: 499, endPage: 502 },
  { id: 46, name: "Al-Ahqaf", arabic: "الأحقاف", totalAyahs: 35, startPage: 502, endPage: 506 },
  { id: 47, name: "Muhammad", arabic: "محمد", totalAyahs: 38, startPage: 507, endPage: 510 },
  { id: 48, name: "Al-Fath", arabic: "الفتح", totalAyahs: 29, startPage: 511, endPage: 515 },
  { id: 49, name: "Al-Hujurat", arabic: "الحجرات", totalAyahs: 18, startPage: 515, endPage: 517 },
  { id: 50, name: "Qaf", arabic: "ق", totalAyahs: 45, startPage: 518, endPage: 520 },
  { id: 51, name: "Adh-Dhariyat", arabic: "الذاريات", totalAyahs: 60, startPage: 520, endPage: 523 },
  { id: 52, name: "At-Tur", arabic: "الطور", totalAyahs: 49, startPage: 523, endPage: 525 },
  { id: 53, name: "An-Najm", arabic: "النجم", totalAyahs: 62, startPage: 526, endPage: 528 },
  { id: 54, name: "Al-Qamar", arabic: "القمر", totalAyahs: 55, startPage: 528, endPage: 531 },
  { id: 55, name: "Ar-Rahman", arabic: "الرحمن", totalAyahs: 78, startPage: 531, endPage: 534 },
  { id: 56, name: "Al-Waqi'ah", arabic: "الواقعة", totalAyahs: 96, startPage: 534, endPage: 537 },
  { id: 57, name: "Al-Hadid", arabic: "الحديد", totalAyahs: 29, startPage: 537, endPage: 541 },
  { id: 58, name: "Al-Mujadila", arabic: "المجادلة", totalAyahs: 22, startPage: 542, endPage: 545 },
  { id: 59, name: "Al-Hashr", arabic: "الحشر", totalAyahs: 24, startPage: 545, endPage: 548 },
  { id: 60, name: "Al-Mumtahanah", arabic: "الممتحنة", totalAyahs: 13, startPage: 549, endPage: 551 },
  { id: 61, name: "As-Saff", arabic: "الصف", totalAyahs: 14, startPage: 551, endPage: 552 },
  { id: 62, name: "Al-Jumu'ah", arabic: "الجمعة", totalAyahs: 11, startPage: 553, endPage: 554 },
  { id: 63, name: "Al-Munafiqun", arabic: "المنافقون", totalAyahs: 11, startPage: 554, endPage: 555 },
  { id: 64, name: "At-Taghabun", arabic: "التغابن", totalAyahs: 18, startPage: 556, endPage: 557 },
  { id: 65, name: "At-Talaq", arabic: "الطلاق", totalAyahs: 12, startPage: 558, endPage: 559 },
  { id: 66, name: "At-Tahrim", arabic: "التحريم", totalAyahs: 12, startPage: 560, endPage: 561 },
  { id: 67, name: "Al-Mulk", arabic: "الملك", totalAyahs: 30, startPage: 562, endPage: 564 },
  { id: 68, name: "Al-Qalam", arabic: "القلم", totalAyahs: 52, startPage: 564, endPage: 566 },
  { id: 69, name: "Al-Haqqah", arabic: "الحاقة", totalAyahs: 52, startPage: 566, endPage: 568 },
  { id: 70, name: "Al-Ma'arij", arabic: "المعارج", totalAyahs: 44, startPage: 568, endPage: 570 },
  { id: 71, name: "Nuh", arabic: "نوح", totalAyahs: 28, startPage: 570, endPage: 571 },
  { id: 72, name: "Al-Jinn", arabic: "الجن", totalAyahs: 28, startPage: 572, endPage: 573 },
  { id: 73, name: "Al-Muzzammil", arabic: "المزمل", totalAyahs: 20, startPage: 574, endPage: 575 },
  { id: 74, name: "Al-Muddaththir", arabic: "المدثر", totalAyahs: 56, startPage: 575, endPage: 577 },
  { id: 75, name: "Al-Qiyamah", arabic: "القيامة", totalAyahs: 40, startPage: 577, endPage: 578 },
  { id: 76, name: "Al-Insan", arabic: "الإنسان", totalAyahs: 31, startPage: 578, endPage: 580 },
  { id: 77, name: "Al-Mursalat", arabic: "المرسلات", totalAyahs: 50, startPage: 580, endPage: 581 },
  { id: 78, name: "An-Naba'", arabic: "النبأ", totalAyahs: 40, startPage: 582, endPage: 583 },
  { id: 79, name: "An-Nazi'at", arabic: "النازعات", totalAyahs: 46, startPage: 583, endPage: 584 },
  { id: 80, name: "'Abasa", arabic: "عبس", totalAyahs: 42, startPage: 585, endPage: 586 },
  { id: 81, name: "At-Takwir", arabic: "التكوير", totalAyahs: 29, startPage: 586, endPage: 587 },
  { id: 82, name: "Al-Infitar", arabic: "الانفطار", totalAyahs: 19, startPage: 587, endPage: 587 },
  { id: 83, name: "Al-Mutaffifin", arabic: "المطففين", totalAyahs: 36, startPage: 587, endPage: 589 },
  { id: 84, name: "Al-Inshiqaq", arabic: "الانشقاق", totalAyahs: 25, startPage: 589, endPage: 590 },
  { id: 85, name: "Al-Buruj", arabic: "البروج", totalAyahs: 22, startPage: 590, endPage: 591 },
  { id: 86, name: "At-Tariq", arabic: "الطارق", totalAyahs: 17, startPage: 591, endPage: 592 },
  { id: 87, name: "Al-A'la", arabic: "الأعلى", totalAyahs: 19, startPage: 591, endPage: 592 },
  { id: 88, name: "Al-Ghashiyah", arabic: "الغاشية", totalAyahs: 26, startPage: 592, endPage: 593 },
  { id: 89, name: "Al-Fajr", arabic: "الفجر", totalAyahs: 30, startPage: 593, endPage: 594 },
  { id: 90, name: "Al-Balad", arabic: "البلد", totalAyahs: 20, startPage: 594, endPage: 595 },
  { id: 91, name: "Ash-Shams", arabic: "الشمس", totalAyahs: 15, startPage: 595, endPage: 595 },
  { id: 92, name: "Al-Layl", arabic: "الليل", totalAyahs: 21, startPage: 595, endPage: 596 },
  { id: 93, name: "Ad-Duha", arabic: "الضحى", totalAyahs: 11, startPage: 596, endPage: 596 },
  { id: 94, name: "Ash-Sharh", arabic: "الشرح", totalAyahs: 8, startPage: 596, endPage: 597 },
  { id: 95, name: "At-Tin", arabic: "التين", totalAyahs: 8, startPage: 597, endPage: 597 },
  { id: 96, name: "Al-'Alaq", arabic: "العلق", totalAyahs: 19, startPage: 597, endPage: 598 },
  { id: 97, name: "Al-Qadr", arabic: "القدر", totalAyahs: 5, startPage: 598, endPage: 598 },
  { id: 98, name: "Al-Bayyinah", arabic: "البينة", totalAyahs: 8, startPage: 598, endPage: 599 },
  { id: 99, name: "Az-Zalzalah", arabic: "الزلزلة", totalAyahs: 8, startPage: 599, endPage: 599 },
  { id: 100, name: "Al-'Adiyat", arabic: "العاديات", totalAyahs: 11, startPage: 599, endPage: 600 },
  { id: 101, name: "Al-Qari'ah", arabic: "القارعة", totalAyahs: 11, startPage: 600, endPage: 600 },
  { id: 102, name: "At-Takathur", arabic: "التكاثر", totalAyahs: 8, startPage: 600, endPage: 600 },
  { id: 103, name: "Al-'Asr", arabic: "العصر", totalAyahs: 3, startPage: 601, endPage: 601 },
  { id: 104, name: "Al-Humazah", arabic: "الهمزة", totalAyahs: 9, startPage: 601, endPage: 601 },
  { id: 105, name: "Al-Fil", arabic: "الفيل", totalAyahs: 5, startPage: 601, endPage: 601 },
  { id: 106, name: "Quraysh", arabic: "قريش", totalAyahs: 4, startPage: 602, endPage: 602 },
  { id: 107, name: "Al-Ma'un", arabic: "الماعون", totalAyahs: 7, startPage: 602, endPage: 602 },
  { id: 108, name: "Al-Kawthar", arabic: "الكوثر", totalAyahs: 3, startPage: 602, endPage: 602 },
  { id: 109, name: "Al-Kafirun", arabic: "الكافرون", totalAyahs: 6, startPage: 603, endPage: 603 },
  { id: 110, name: "An-Nasr", arabic: "النصر", totalAyahs: 3, startPage: 603, endPage: 603 },
  { id: 111, name: "Al-Masad", arabic: "المسد", totalAyahs: 5, startPage: 603, endPage: 603 },
  { id: 112, name: "Al-Ikhlas", arabic: "الإخلاص", totalAyahs: 4, startPage: 604, endPage: 604 },
  { id: 113, name: "Al-Falaq", arabic: "الفلق", totalAyahs: 5, startPage: 604, endPage: 604 },
  { id: 114, name: "An-Nas", arabic: "الناس", totalAyahs: 6, startPage: 604, endPage: 604 }
];

export const SURAH_LIST = FULL_SURAH_LIST;
