/**
 * Secure Quran Manuscript Lookup Utility for Academic Quran Portal
 * Returns direct high-speed /api/page_image/{pageNum} URL or resolves in-memory cache.
 */

export const getPageImageUrl = (pageNum) => {
  if (pageNum === undefined || pageNum === null) return '';
  const num = Number(pageNum);
  if (isNaN(num) || num < 1 || num > 604) return '';
  return `/api/page_image/${num}`;
};

export const getPageFromManuscript = (quranData, pageNum) => {
  if (pageNum === undefined || pageNum === null) return null;
  const targetNum = Number(pageNum);
  if (isNaN(targetNum) || targetNum < 1 || targetNum > 604) return null;

  if (Array.isArray(quranData) && quranData.length > 0) {
    const item = quranData.find(item => Number(item?.page_number) === targetNum);
    if (item) return item;
  } else if (typeof quranData === 'object' && quranData !== null) {
    const matchedKey = Object.keys(quranData).find(k => Number(k) === targetNum);
    if (matchedKey) {
      const value = quranData[matchedKey];
      if (value && typeof value === 'object') {
        return {
          page_number: targetNum,
          image_base64: value.image_base64 || value.image || value.misri_quran || value.text || value.manuscript || `/api/page_image/${targetNum}`
        };
      }
      return {
        page_number: targetNum,
        image_base64: typeof value === 'string' ? value : `/api/page_image/${targetNum}`
      };
    }
  }
  
  // High-performance direct API fallback
  return {
    page_number: targetNum,
    image_base64: `/api/page_image/${targetNum}`
  };
};
