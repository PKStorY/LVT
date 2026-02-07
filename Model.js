/**
 * ------------------------------------------------------------------
 * MODEL & DATA ACCESS
 * จัดการการดึงข้อมูล Cache และการติดต่อกับ Spreadsheet ในระดับล่าง
 * ------------------------------------------------------------------
 */

// Helper Function for Caching Stalls Data
function getStallsDataCached() {
  const cache = CacheService.getScriptCache();
  // เปลี่ยนชื่อ key เป็น v2 เพื่อบังคับให้ระบบดึงข้อมูลใหม่จาก Sheet ทันที (แก้ปัญหาราคาไม่อัปเดต)
  const cached = cache.get("stalls_data_v2");
  
  if (cached) {
    return JSON.parse(cached);
  }

  const ssSetup = SpreadsheetApp.openById(SHEET_ID_SETUP);
  const sheetStalls = ssSetup.getSheetByName("Stalls");
  const stallsData = sheetStalls.getDataRange().getValues();
  stallsData.shift(); // เอา Header ออก
  
  const stallsMap = stallsData.map(row => ({
    name: row[0], row: row[1], col: row[2], type: row[3],
    priceWed: row[4], priceSat: row[5], priceSun: row[6],
    priceMonth: row[7] // Column H
  }));

  // เก็บลง Cache 6 ชั่วโมง
  cache.put("stalls_data_v2", JSON.stringify(stallsMap), 21600);
  return stallsMap;
}