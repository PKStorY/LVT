/**
 * ------------------------------------------------------------------
 * SERVICE: VALIDATOR
 * ตรวจสอบความถูกต้องของข้อมูล (Collision Check)
 * ------------------------------------------------------------------
 */

const ServiceValidator = {
  checkCollision: function(targetEntries, currentBookingId) {
    const freshData = RepoDaily.getAllBookings(); // Read once
    
    for (let entry of targetEntries) {
      let checkStall = entry.stallNameOverride;
      let checkDateStr = Utils.formatDateForSheet(entry.date);
      
      for (let row of freshData) {
        let rowId = row[0];
        let rowDateStr = Utils.formatDateForSheet(row[1]);
        let rowStall = row[2];
        let rowStatus = row[11]; // Col L
        
        if (rowDateStr === checkDateStr && rowStall == checkStall) {
          // ถ้าสถานะไม่ใช่ "ลา" และไม่ใช่ ID ตัวเอง = ชน!
          if (rowStatus !== "ลา") {
              if (rowId !== currentBookingId) {
                  return `จองไม่ได้! ล็อค ${rowStall} วันที่ ${Utils.formatDateForSheet(entry.date)} ไม่ว่าง`;
              }
          }
        }
      }
    }
    return null; // Pass
  }
};