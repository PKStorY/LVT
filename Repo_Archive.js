/**
 * ------------------------------------------------------------------
 * REPOSITORY: ARCHIVE
 * จัดการการอ่านข้อมูลย้อนหลัง (Read-Only) สำหรับ Dashboard
 * ------------------------------------------------------------------
 */

const RepoArchive = {
  getSheet: function() {
    const ss = SpreadsheetApp.openById(SHEET_ID_ARCHIVE);
    return ss.getSheetByName("Archive_Data");
  },

  // ดึงข้อมูลการจองย้อนหลังตามวันที่
  getBookingsByDate: function(dateStr) {
    const sheet = this.getSheet();
    if (!sheet) return [];
    
    // Archive อาจจะมีข้อมูลเยอะมาก การอ่านทั้งหมดอาจช้า 
    // ในระยะยาวควรใช้วิธีอื่น แต่เบื้องต้นอ่านทั้งหมดแล้วกรองใน Memory (เร็วพอสำหรับ < 50k แถว)
    const data = sheet.getDataRange().getValues();
    const targetDate = Utils.formatDateForSheet(dateStr);
    
    return data.filter(row => {
      // row[1] คือ Column B (Date)
      if (!row[1]) return false;
      
      let rowDateStr = "";
      try {
          rowDateStr = Utils.formatDateForSheet(row[1]);
      } catch (e) { return false; }
      
      return rowDateStr === targetDate;
    }).map(row => ({
      id: row[0], 
      date: Utils.formatDateForSheet(row[1]),
      stallName: row[2], bookerName: row[3],
      product: row[4], type: row[5], elecUnit: row[6], elecPrice: row[7],
      stallPrice: row[8], totalPrice: row[9], paymentMethod: row[10],
      status: row[11], note: row[12], 
      paidAmount: parseFloat(row[9] || 0),
      masterId: row[14], 
      storageFee: parseFloat(row[15] || 0)
    }));
  }
};