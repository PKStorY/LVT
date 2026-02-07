/**
 * ------------------------------------------------------------------
 * SERVICE: ARCHIVE (SAFE MODE)
 * ย้ายข้อมูลเก่าไปเก็บ ด้วยวิธี Copy -> Flush -> Delete Rows
 * ป้องกันข้อมูลหายหากเกิด Timeout
 * ------------------------------------------------------------------
 */

const ServiceArchive = {
  runDailyArchive: function() {
    const lock = LockService.getScriptLock();
    // รอ Lock นานหน่อยเพราะการทำงานกับข้อมูลจำนวนมากอาจใช้เวลา
    try { lock.waitLock(30000); } catch (e) { return "ระบบกำลังทำงานอื่นอยู่ กรุณาลองใหม่"; }

    try {
        const ssDaily = SpreadsheetApp.openById(SHEET_ID_DAILY);
        const sheetBookings = ssDaily.getSheetByName("Bookings");
        
        // อ่านข้อมูลทั้งหมดทีเดียว
        const range = sheetBookings.getDataRange();
        const allValues = range.getValues();
        
        if (allValues.length <= 1) return "ไม่มีข้อมูลให้ดำเนินการ";

        const header = allValues[0];
        const dataRows = allValues.slice(1); // ข้อมูลเริ่มที่ index 1

        const ssArchive = SpreadsheetApp.openById(SHEET_ID_ARCHIVE);
        let sheetArchive = ssArchive.getSheetByName("Archive_Data");
        if (!sheetArchive) {
           sheetArchive = ssArchive.insertSheet("Archive_Data");
           sheetArchive.appendRow(header);
        }
        
        const today = new Date();
        today.setHours(0,0,0,0); // เที่ยงคืนของวันนี้
        
        const rowsToArchive = [];
        const rowsIndicesToDelete = []; // เก็บเลขแถวที่จะลบ (1-based row number)

        let countMoved = 0;
        let countDeleted = 0;

        // วนลูปแยกข้อมูล
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const rowDateVal = row[1]; // Column B: Date
            const rentType = row[5];   // Column F: Rent Type
            
            let rowDate;
            if (rowDateVal instanceof Date) {
                rowDate = rowDateVal;
            } else {
                rowDate = new Date(rowDateVal);
            }
            rowDate.setHours(0,0,0,0);

            // เงื่อนไข: ข้อมูลเก่ากว่าวันนี้
            if (rowDate.getTime() < today.getTime()) {
                // เลขแถวใน Sheet = index + 2 (เพราะ dataRows ตัด header ไปแล้ว 1 แถว)
                rowsIndicesToDelete.push(i + 2);

                if (rentType === 'รายวัน') {
                    rowsToArchive.push(row);
                    countMoved++;
                } else {
                    // รายเดือน หรืออื่นๆ ลบทิ้งจาก Daily แต่ไม่ลง Archive (ตาม Logic เดิม)
                    countDeleted++;
                }
            } 
        }
        
        // 1. บันทึกลง Archive (Safety Step 1: Copy ก่อน)
        if (rowsToArchive.length > 0) {
            const lastRowArch = sheetArchive.getLastRow();
            sheetArchive.getRange(lastRowArch + 1, 1, rowsToArchive.length, rowsToArchive[0].length).setValues(rowsToArchive);
            SpreadsheetApp.flush(); // บังคับเขียนลง Sheet ทันที เพื่อความปลอดภัย
        }
        
        // 2. ลบข้อมูลเก่าออกจาก Daily (Safety Step 2: ลบเฉพาะแถวที่ย้ายแล้ว)
        // เรียกใช้ฟังก์ชันลบที่ปรับปรุงแล้วใน RepoDaily
        if (rowsIndicesToDelete.length > 0) {
            RepoDaily.deleteRowsOptimized(sheetBookings, rowsIndicesToDelete);
        }
        
        return `เก็บข้อมูลเก่าเรียบร้อย:\n- ย้ายรายวันไป Archive: ${countMoved} รายการ\n- ล้างข้อมูลรายเดือนเก่า: ${countDeleted} รายการ`;

    } catch(e) {
        return "เกิดข้อผิดพลาด: " + e.toString();
    } finally {
        lock.releaseLock();
    }
  }
};