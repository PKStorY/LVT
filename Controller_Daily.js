/**
 * ------------------------------------------------------------------
 * CONTROLLER: DAILY OPERATIONS
 * ฟังก์ชันสำหรับการจัดการล็อครายวันโดยเฉพาะ
 * ------------------------------------------------------------------
 */

// ลบการจองรายวัน (ลบแถวใน Sheet)
function deleteBooking(dateStr, bookingId) {
    const sheet = RepoDaily.getSheet();
    const data = sheet.getDataRange().getValues();
    const targetDate = Utils.formatDateForSheet(dateStr);
    const rowsToDelete = [];
    for (let i = data.length - 1; i >= 1; i--) {
        const rowDate = Utils.formatDateForSheet(data[i][1]);
        const rowId = data[i][0];
        const masterRef = data[i][14]; 
        if (rowDate === targetDate) {
            if (rowId === bookingId || masterRef === bookingId) {
                rowsToDelete.push(i + 1);
            }
        }
    }
    if (rowsToDelete.length > 0) {
        rowsToDelete.forEach(rowIndex => sheet.deleteRow(rowIndex));
        return { success: true, message: `ลบสำเร็จ ${rowsToDelete.length} รายการในกลุ่ม` };
    }
    return { success: false, message: "ไม่พบข้อมูลที่ตรงกัน" };
}

// ตั้งสถานะเป็น "ลา"
function setBookingStatusLeave(bookingId) {
    const success = RepoDaily.setStatusLeave(bookingId);
    if(success) return { success: true, message: "สถานะเปลี่ยนเป็น 'ลา' เรียบร้อย" };
    return { success: false, message: "ไม่พบข้อมูล" };
}

// เพิ่มค่าไฟ (เฉพาะรายวันหรือรายเดือนที่คิดไฟเพิ่มทีหลัง)
function addElectricity(bookingId, unit, amount, method, note, officerName) {
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(5000);
        
        const breakdown = { stall: 0, elec: amount, storage: 0 };
        ServiceFinance.recordPayment(bookingId, "ค่าไฟเพิ่ม", amount, method, note, officerName, breakdown, "Utility");
        
        const ssDaily = SpreadsheetApp.openById(SHEET_ID_DAILY);
        const sheet = ssDaily.getSheetByName("Bookings");
        const data = sheet.getDataRange().getValues();
        
        for(let i=1; i<data.length; i++) {
            if(data[i][0] === bookingId) {
                const currentUnit = parseFloat(data[i][6] || 0);
                const currentElecPrice = parseFloat(data[i][7] || 0);
                const currentTotal = parseFloat(data[i][9] || 0);
                
                const newUnit = currentUnit + parseFloat(unit);
                const newElecPrice = currentElecPrice + parseFloat(amount); 
                const newTotal = currentTotal + parseFloat(amount);
                
                sheet.getRange(i+1, 7).setValue(newUnit); 
                sheet.getRange(i+1, 8).setValue(newElecPrice); 
                sheet.getRange(i+1, 10).setValue(newTotal); 
                
                ServiceFinance.updateBookingStatus(bookingId);
                break;
            }
        }
        return { success: true, message: "เพิ่มค่าไฟเรียบร้อย" };
    } catch(e) { return { success: false, message: e.toString() }; } finally { lock.releaseLock(); }
}