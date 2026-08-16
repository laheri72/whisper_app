/**
 * Secure Quran JSON Lookup Utility for Academic Quran Portal
 * Safely resolves page lookups across numeric, zero-padded, array, or object mappings.
 */

export const getPageFromManuscript = (quranData, pageNum) => {
  if (!quranData || pageNum === undefined || pageNum === null) return null;
  const targetNum = Number(pageNum);
  if (isNaN(targetNum)) return null;

  if (Array.isArray(quranData)) {
    // Look up in array
    return quranData.find(item => Number(item?.page_number) === targetNum) || null;
  } else if (typeof quranData === 'object') {
    // Look up in key-value dictionary
    const keys = Object.keys(quranData);
    
    // First, check direct string representation of number (e.g. "1" or "001")
    const matchedKey = keys.find(k => Number(k) === targetNum);
    if (matchedKey) {
      const value = quranData[matchedKey];
      // Normalize object to match target schema { page_number, image_base64 }
      if (value && typeof value === 'object') {
        return {
          page_number: targetNum,
          image_base64: value.image_base64 || value.image || value.misri_quran || value.text || value.manuscript || ""
        };
      }
      return {
        page_number: targetNum,
        image_base64: typeof value === 'string' ? value : ""
      };
    }
  }
  return null;
};
