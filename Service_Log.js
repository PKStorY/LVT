/**
 * ------------------------------------------------------------------
 * SERVICE: LOGGING
 * จัดการการบันทึกประวัติการใช้งาน (Access Logs)
 * ------------------------------------------------------------------
 */

const ServiceLog = {
  // บันทึกประวัติการเข้าใช้งาน
  recordAccess: function(username, name, role, action, status) {
    try {
      const ss = SpreadsheetApp.openById(SHEET_ID_LOGS);
      let sheet = ss.getSheetByName("Access_Logs");
      
      // ถ้ายังไม่มีชีต ให้สร้างใหม่พร้อมหัวตาราง
      if (!sheet) {
        sheet = ss.insertSheet("Access_Logs");
        sheet.appendRow(["Timestamp", "Username", "Name", "Role", "Action", "Status"]);
      }
      
      const timestamp = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");
      
      // บันทึกลงแถวใหม่
      sheet.appendRow([
        timestamp, 
        username, 
        name, 
        role, 
        action, 
        status
      ]);
      
    } catch (e) {
      // กรณีเกิด Error (เช่น หาชีตไม่เจอ) ให้ log ลง console แต่ไม่ให้กระทบการทำงานหลัก
      console.error("Logging failed: " + e.toString());
    }
  }
};
