/**
 * ------------------------------------------------------------------
 * SERVICE: STORAGE
 * Business Logic สำหรับระบบฝากของ
 * Update: Check for duplicate Booking ID before creating
 * ------------------------------------------------------------------
 */

const ServiceStorage = {
  getActiveStorageMap: function() {
    const activeItems = RepoStorage.getActiveStorage();
    const map = {};
    const today = new Date();
    today.setHours(0,0,0,0);

    activeItems.forEach(item => {
        const endD = new Date(item.endDate);
        endD.setHours(0,0,0,0);
        item.isExpired = (today > endD);
        map[item.stallName] = item;
    });
    return map;
  },

  // FIX: Updated create logic to check for duplicates
  createStorage: function(formObj) {
    // 1. Check if Booking ID exists and is Active
    if (formObj.bookingId) {
        const existing = RepoStorage.findActiveByBookingId(formObj.bookingId);
        if (existing) {
            // Found existing -> Update it
            RepoStorage.updateStorageFromBooking(existing.rowIndex, formObj);
            return { success: true, message: "อัปเดตข้อมูลฝากของเรียบร้อย", storageId: existing.id, action: "updated" };
        }
    }

    // 2. If not found, create new
    const id = `STR-${Utils.getTimestamp().replace(/[-: ]/g, "").slice(2,14)}`;
    
    let startDate, endDate;
    if (formObj.customStartDate && formObj.customEndDate) {
        startDate = new Date(formObj.customStartDate);
        endDate = new Date(formObj.customEndDate);
    } else {
        startDate = new Date();
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); 
    }
    
    const row = [
        id,
        formObj.stallName,
        formObj.ownerName,
        formObj.phone,
        Utils.formatDateForSheet(startDate),
        Utils.formatDateForSheet(endDate),
        "Active",
        formObj.note,
        Utils.getTimestamp(),
        formObj.bookingId || "" // Add Ref Booking ID
    ];
    
    RepoStorage.saveStorage(row);
    return { success: true, message: "บันทึกการฝากของเรียบร้อย", storageId: id, action: "created" };
  },

  moveToHolding: function(storageId) {
     const success = RepoStorage.moveStorage(storageId, "Holding Area", "Active");
     if (success) return { success: true, message: "ย้ายของไปจุดพักเรียบร้อย" };
     return { success: false, message: "ไม่พบข้อมูล" };
  },
  
  returnItem: function(storageId) {
     const success = RepoStorage.completeStorage(storageId);
     if (success) return { success: true, message: "คืนของเรียบร้อย (จบงาน)" };
     return { success: false, message: "ไม่พบข้อมูล" };
  }
};