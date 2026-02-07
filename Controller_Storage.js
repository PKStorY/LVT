/**
 * ------------------------------------------------------------------
 * CONTROLLER: STORAGE
 * API สำหรับระบบฝากของ
 * Update: FIX Logic Pay Now (Separate) vs Pay Later (Update Booking Debt, No Storage Record)
 * Update: FIX Calculation bug (Add fee to Master Row only)
 * ------------------------------------------------------------------
 */

function saveStorageItem(formObj) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    
    const isPayNow = formObj.payNow === true || formObj.payNow === "true"; 
    const fee = parseFloat(formObj.amount || 0);
    let result = { success: true };

    // CASE A: Pay Later (แปะไว้) -> Update Booking Sheet ONLY (Do NOT create storage record yet)
    if (formObj.bookingId && !isPayNow && fee > 0) {
        const ssDaily = SpreadsheetApp.openById(SHEET_ID_DAILY);
        const sheet = ssDaily.getSheetByName("Bookings");
        const data = sheet.getDataRange().getValues();
        
        let updated = false;

        // 1. Try to find Master Row first (ID matches BookingID)
        for (let i = 1; i < data.length; i++) {
            if (String(data[i][0]) === String(formObj.bookingId)) {
                updateSheetRow(sheet, i + 1, data[i], fee);
                updated = true;
                break; // Update ONLY ONE row (Master)
            }
        }
        
        // 2. If Master Row not found, update the first Sub-Row found
        if (!updated) {
            for (let i = 1; i < data.length; i++) {
                if (String(data[i][14]) === String(formObj.bookingId)) {
                    updateSheetRow(sheet, i + 1, data[i], fee);
                    updated = true;
                    break; // Update ONLY ONE row
                }
            }
        }
        
        if (updated) {
            result.message = "บันทึกยอดฝากของ (ค้างชำระ) เรียบร้อย";
        } else {
            return { success: false, message: "ไม่พบข้อมูลการจองเพื่อบันทึกยอด" };
        }
    }

    // CASE B: Pay Now -> Create Storage Record AND Transaction (Do NOT update Booking Sheet Debt)
    if (isPayNow && fee > 0) {
        // 1. Create Storage Record
        const storageResult = ServiceStorage.createStorage(formObj);
        result = storageResult; // Keep storageId and success status
        
        // 2. Record Transaction
        const officer = "System"; 
        const refId = formObj.bookingId || storageResult.storageId || "STORAGE-WALK-IN";
        
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
    
    // Case: Save without payment (Standard Storage, e.g. Free or Manual logic not covered above but standard create)
    // If not PayLater(Booking) and not PayNow(Fee>0), assume standard create (e.g. fee=0 or walk-in pay later?)
    // For safety, if we haven't done Case A or B, just create the record.
    if (!formObj.bookingId && !isPayNow) {
         result = ServiceStorage.createStorage(formObj);
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