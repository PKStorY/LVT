/**
 * ------------------------------------------------------------------
 * CONTROLLER: STORAGE
 * API สำหรับระบบฝากของ
 * Update: Logic ใหม่ "Create Record Always" (สร้างใบฝากเสมอ แม้ยังไม่จ่าย)
 * Update: Pay Later -> Update Booking Debt (ถ้ามี Booking)
 * ------------------------------------------------------------------
 */

function saveStorageItem(formObj) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    
    const isPayNow = formObj.payNow === true || formObj.payNow === "true"; 
    const fee = parseFloat(formObj.amount || 0);
    let result = { success: true };

    // 1. ALWAYS Create/Update Storage Record first (เพื่อให้มีข้อมูลในระบบและแสดงบนผัง)
    // --------------------------------------------------------------------------------
    let storageResult;
    
    // ตรวจสอบว่ามี Booking ID นี้ฝากอยู่แล้วหรือไม่ (ป้องกันการสร้างซ้ำซ้อนถ้ากดฝากซ้ำจากหน้าเดิม)
    // แต่ถ้าเป็นการ "เพิ่ม" รายการใหม่ (Manual Add) ก็จะสร้างใหม่
    if (formObj.bookingId) {
        const existing = RepoStorage.findActiveByBookingId(formObj.bookingId);
        if (existing) {
             // ถ้ามีอยู่แล้ว ให้อัปเดตข้อมูลแทน
             RepoStorage.updateStorageFromBooking(existing.rowIndex, formObj);
             storageResult = { success: true, storageId: existing.id, action: "updated" };
        } else {
             // ถ้าไม่มี ให้สร้างใหม่
             storageResult = ServiceStorage.createStorage(formObj);
        }
    } else {
        // กรณี Walk-in หรือไม่มี Booking ID -> สร้างใหม่เสมอ
        storageResult = ServiceStorage.createStorage(formObj);
    }
    
    result = storageResult;
    result.message = "บันทึกข้อมูลฝากของเรียบร้อย";

    // 2. Handle Finance (แยกจัดการเรื่องเงิน)
    // --------------------------------------------------------------------------------
    if (fee > 0) {
        if (isPayNow) {
            // CASE A: Pay Now -> บันทึก Transaction รับเงินเลย
            const officer = "System"; 
            // ใช้ ID ของ Booking เป็น Ref ถ้ามี, ถ้าไม่มีใช้ Storage ID
            const refId = formObj.bookingId || storageResult.storageId;
            
            const breakdown = { stall: 0, elec: 0, storage: fee };
            ServiceFinance.recordPayment(
                refId, 
                "ค่าฝากของ", 
                formObj.amount, 
                formObj.method, 
                `ค่าฝากของล็อค ${formObj.stallName} (${formObj.note || "-"})`, 
                officer,
                breakdown,
                "Storage"
            );
            result.message = "บันทึกฝากของและชำระเงินเรียบร้อย";
        } 
        else if (formObj.bookingId) {
            // CASE B: Pay Later + มี Booking -> แปะหนี้ไว้ที่ Booking (เพิ่มยอด Total, ไม่สร้าง Transaction)
            const ssDaily = SpreadsheetApp.openById(SHEET_ID_DAILY);
            const sheet = ssDaily.getSheetByName("Bookings");
            const data = sheet.getDataRange().getValues();
            
            let updated = false;

            // Update Master Row
            for (let i = 1; i < data.length; i++) {
                if (String(data[i][0]) === String(formObj.bookingId)) {
                    updateSheetRow(sheet, i + 1, data[i], fee);
                    updated = true;
                    break;
                }
            }
            
            // If Master not found, try Sub-Row
            if (!updated) {
                for (let i = 1; i < data.length; i++) {
                    if (String(data[i][14]) === String(formObj.bookingId)) {
                        updateSheetRow(sheet, i + 1, data[i], fee);
                        updated = true;
                        break;
                    }
                }
            }
            
            if (updated) {
                result.message = "บันทึกฝากของ และเพิ่มยอดหนี้ใน Booking เรียบร้อย";
            }
        }
        // CASE C: Pay Later + ไม่มี Booking (Walk-in)
        // สร้างแค่ Record ฝากของ (สถานะ Active) แต่ไม่มีที่เก็บหนี้ใน Booking Sheet
        // ข้อมูลจะโชว์ใน Storage List ว่า Active (เจ้าหน้าที่ต้องตามเก็บตอนคืนของ)
    }
    
    return result;

  } catch (e) {
    return { success: false, message: "Server Error: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// Helper to update row values
function updateSheetRow(sheet, rowIndex, rowData, fee) {
    const currentTotal = parseFloat(rowData[9] || 0);   // Col J
    const currentStorage = parseFloat(rowData[15] || 0); // Col P
    
    const newStorage = currentStorage + fee;
    const newTotal = currentTotal + fee;
    
    sheet.getRange(rowIndex, 10).setValue(newTotal); // Update Total
    sheet.getRange(rowIndex, 16).setValue(newStorage); // Update Storage Fee
    
    // Set status to Overdue if debt increased
    sheet.getRange(rowIndex, 12).setValue("ค้างชำระ");
}

// API for Storage Management Console
function getStorageList() {
  try {
    const data = RepoStorage.getAllStorageData();
    return { success: true, data: data };
  } catch (e) {
    return { success: false, message: "Failed to load storage list: " + e.toString() };
  }
}

function moveStorageToHolding(storageId) {
  return ServiceStorage.moveToHolding(storageId);
}

function completeStorageItem(storageId) {
  return ServiceStorage.returnItem(storageId);
}

function moveStorageLocation(storageId, newLocation) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const success = RepoStorage.updateStorageLocation(storageId, newLocation);
    if (success) {
        return { success: true, message: "ย้ายตำแหน่งเรียบร้อย" };
    } else {
        return { success: false, message: "ไม่พบข้อมูล" };
    }
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}