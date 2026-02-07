/**
 * ------------------------------------------------------------------
 * CONTROLLER: MONTHLY OPERATIONS
 * ฟังก์ชันสำหรับการจัดการข้อมูลรายเดือนโดยเฉพาะ
 * ------------------------------------------------------------------
 */

// ดึงข้อมูลรายเดือนทั้งหมด
function getMonthlyBookingsExternal() {
    const data = RepoMonthly.getSheetData();
    const mapped = data.map(row => ({
      id: row[0], timestamp: row[1], startDate: row[2], bookerName: row[3],
      stalls: row[4], product: row[5], status: row[6], elecUnit: row[7],
      totalPrice: row[8], paid: row[9], note: row[10], paymentMethod: row[11],
      selectedDays: row[12], bookingMonth: row[13] || "-", phone: row[14] || "-",
      stallDetails: row[15] || "",
      customerType: row[16] || "Standard",
      storageFee: row[17] || 0,
      renewalStatus: row[18] || ""
    }));
    return { success: true, data: mapped.reverse() };
}

// เปลี่ยนสถานะแจ้งต่อสัญญา/แจ้งออก
function toggleRenewalStatus(bookingId, currentStatus) {
    const newStatus = (currentStatus === "แจ้งออก") ? "" : "แจ้งออก";
    const success = RepoMonthly.toggleRenewal(bookingId, newStatus);
    if(success) return { success: true, message: "สถานะอัปเดตเรียบร้อย", newStatus: newStatus };
    return { success: false, message: "ไม่พบข้อมูล" };
}

// คำนวณยอดเงินรายเดือนใหม่ทั้งหมด (Batch Fix)
function batchRecalculateMonthlyTotals() {
  const lock = LockService.getScriptLock();
  try {
      lock.waitLock(30000);
      const ssMonthly = SpreadsheetApp.openById(SHEET_ID_MONTHLY_EXTERNAL);
      const sheetMonthly = ssMonthly.getSheetByName("Monthly_Data");
      const data = sheetMonthly.getDataRange().getValues();
      
      const ssSetup = SpreadsheetApp.openById(SHEET_ID_SETUP);
      const sheetStalls = ssSetup.getSheetByName("Stalls");
      const stallsData = sheetStalls.getDataRange().getValues();

      let updateCount = 0;
      
      for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const bookingId = row[0];
          const startDateStr = row[2]; // yyyy-MM-dd
          const elecUnit = parseFloat(row[7] || 0);
          const currentTotal = parseFloat(row[8] || 0);
          const paid = parseFloat(row[9] || 0);
          const stallDetailsJson = row[15];
          const customerType = row[16] || "Standard";
          const storageFee = parseFloat(row[17] || 0);

          if (!stallDetailsJson || stallDetailsJson === "undefined") continue;

          const stallList = Utils.parseJsonSafe(stallDetailsJson, []);
          
          const formObject = {
              rentType: "รายเดือน",
              date: startDateStr,
              customerType: customerType
          };

          const calcResult = ServiceCalc.calculateEntries(formObject, stallList, stallsData);
          const targetEntries = calcResult.entries;
          
          const totalStallPrice = targetEntries.reduce((sum, e) => sum + e.price, 0);
          let totalElecPrice = (elecUnit * 10 * calcResult.totalMonthlyDays);
          if (customerType === 'VIP') totalElecPrice = 0;

          const newGrandTotal = totalStallPrice + totalElecPrice + storageFee;
          
          if (Math.abs(newGrandTotal - currentTotal) > 0.1) {
               row[8] = newGrandTotal;
               let newStatus = "ค้างชำระ";
               if (paid >= (newGrandTotal - 1)) newStatus = "ชำระแล้ว";
               if (customerType === 'Regular') newStatus = "ชำระรายวัน"; 
               row[6] = newStatus;
               updateCount++;
          }
      }

      if (updateCount > 0) {
          sheetMonthly.getRange(1, 1, data.length, data[0].length).setValues(data);
      }

      return { success: true, message: `ซ่อมยอดเงินเรียบร้อย ${updateCount} รายการ` };

  } catch(e) {
      return { success: false, message: e.toString() };
  } finally {
      lock.releaseLock();
  }
}