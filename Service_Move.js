/**
 * ------------------------------------------------------------------
 * SERVICE: MOVE BOOKING
 * จัดการ Logic การย้ายล็อค คำนวณส่วนต่าง และอัปเดตข้อมูล
 * Logic: Store Credit System (Refined)
 * Update: Filter out empty stall names from available list
 * ------------------------------------------------------------------
 */

const ServiceMove = {
  getAvailableStallsForMove: function(targetDateStr) {
      const ssSetup = SpreadsheetApp.openById(SHEET_ID_SETUP);
      const sheetStalls = ssSetup.getSheetByName("Stalls");
      const allStalls = sheetStalls.getDataRange().getValues();
      allStalls.shift(); 

      const bookings = RepoDaily.getAllBookings(); 
      const targetDateSheetFmt = Utils.formatDateForSheet(targetDateStr);
      
      const occupiedStalls = new Set();
      bookings.forEach(row => {
          let rDate = Utils.formatDateForSheet(row[1]);
          let rStall = row[2];
          let rStatus = row[11];
          if (rDate === targetDateSheetFmt && rStatus !== "ลา") {
              occupiedStalls.add(String(rStall).trim());
          }
      });

      const availableStalls = allStalls
          .filter(s => {
              const name = String(s[0]).trim();
              // FIX: Filter out empty names to prevent blank options
              return name !== "" && s[3] !== "ทางเดิน" && s[3] !== "อื่นๆ" && !occupiedStalls.has(name);
          })
          .map(s => String(s[0]).trim())
          .sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
          
      return availableStalls;
  },

  previewMove: function(bookingId, currentStall, newDateStr, newStall) {
    const ssSetup = SpreadsheetApp.openById(SHEET_ID_SETUP);
    const sheetStalls = ssSetup.getSheetByName("Stalls");
    const stallsData = sheetStalls.getDataRange().getValues();
    
    // Trim newStall for robust matching
    const targetStallName = String(newStall).trim();
    const newStallInfo = stallsData.find(r => String(r[0]).trim() === targetStallName);
    if (!newStallInfo) return { success: false, message: `ไม่พบข้อมูลล็อคปลายทาง (${targetStallName})` };
    
    const newDateObj = new Date(newDateStr);
    const dayOfWeek = newDateObj.getDay();
    let newStallPrice = 0;
    
    if (dayOfWeek === 3) newStallPrice = parseFloat(newStallInfo[4] || 0); 
    else if (dayOfWeek === 6) newStallPrice = parseFloat(newStallInfo[5] || 0); 
    else if (dayOfWeek === 0) newStallPrice = parseFloat(newStallInfo[6] || 0); 
    
    const bookings = RepoDaily.getAllBookings(); 
    const groupRows = bookings.filter(r => (String(r[0]) === String(bookingId) || String(r[14]) === String(bookingId)));
    
    if (groupRows.length === 0) return { success: false, message: "ไม่พบข้อมูลการจอง" };

    const targetDateSheetFmt = Utils.formatDateForSheet(newDateObj);
    for (let row of bookings) {
        let rDate = Utils.formatDateForSheet(row[1]);
        let rStall = String(row[2]).trim();
        let rStatus = row[11];
        
        if (rDate === targetDateSheetFmt && rStall === targetStallName && rStatus !== "ลา") {
            return { success: false, message: `ล็อค ${targetStallName} วันที่ ${targetDateSheetFmt} ไม่ว่าง` };
        }
    }
    
    // Get Credit from Actual Transactions (Total Paid)
    let groupCredit = 0;
    try {
        groupCredit = RepoTransaction.getTotalPaid(bookingId);
    } catch (e) { console.warn("Error fetching transactions", e); }

    // Fallback: If no transaction found (0) BUT status is "Paid", use Sheet Total
    if (groupCredit === 0) {
         const firstRow = groupRows[0];
         const status = firstRow[11]; // Col L
         if (status === "ชำระแล้ว" || status === "ชำระรายวัน") {
             groupCredit = groupRows.reduce((sum, r) => sum + parseFloat(r[9]||0), 0);
         }
    }

    // Calculate New Group Cost Real
    let newGroupCostReal = 0;
    
    groupRows.forEach(r => {
        const rStall = String(r[2]).trim(); 
        const rElec = parseFloat(r[7]||0); 
        const rStallPriceCurrent = parseFloat(r[8]||0); 
        const rStorage = parseFloat(r[15]||0); 

        if (rStall === String(currentStall).trim()) {
            // Moving Row: Use New Price + Old Elec + Old Storage
            newGroupCostReal += (newStallPrice + rElec + rStorage);
        } else {
            // Friend Row: Keep As Is
            newGroupCostReal += (rStallPriceCurrent + rElec + rStorage);
        }
    });
    
    const diff = newGroupCostReal - groupCredit;
    
    let msg = "";
    if (diff > 0) {
        msg = `ต้องชำระเพิ่ม ${diff.toLocaleString()} บาท`;
    } else if (diff < 0) {
        msg = `ยอดเงินเกิน ${Math.abs(diff).toLocaleString()} บาท (เก็บเป็นเครดิตในระบบ)`;
    } else {
        msg = `ราคาเท่าเดิม`;
    }
    
    return { 
        success: true, 
        data: {
            oldPrice: groupCredit, 
            newPrice: newGroupCostReal,
            diff: diff,
            message: msg
        }
    };
  },

  executeMove: function(bookingId, currentStall, newDateStr, newStall, newPriceFromPreview, paymentData, officerName) {
    const ssDaily = SpreadsheetApp.openById(SHEET_ID_DAILY);
    const sheet = ssDaily.getSheetByName("Bookings");
    const data = sheet.getDataRange().getValues();
    const newDateSheetFmt = Utils.formatDateForSheet(new Date(newDateStr));
    const targetStallName = String(newStall).trim();
    
    const groupIndices = [];
    
    const ssSetup = SpreadsheetApp.openById(SHEET_ID_SETUP);
    const sheetStalls = ssSetup.getSheetByName("Stalls");
    const stallsData = sheetStalls.getDataRange().getValues();
    const newStallInfo = stallsData.find(r => String(r[0]).trim() === targetStallName);
    
    let realNewStallPrice = 0;
    const newDateObj = new Date(newDateStr);
    const dayOfWeek = newDateObj.getDay();
    if (newStallInfo) {
        if (dayOfWeek === 3) realNewStallPrice = parseFloat(newStallInfo[4] || 0);
        else if (dayOfWeek === 6) realNewStallPrice = parseFloat(newStallInfo[5] || 0);
        else if (dayOfWeek === 0) realNewStallPrice = parseFloat(newStallInfo[6] || 0);
    }

    for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(bookingId) || String(data[i][14]) === String(bookingId)) {
            groupIndices.push(i);
        }
    }
    
    if (groupIndices.length === 0) return { success: false, message: "ไม่พบข้อมูล" };

    groupIndices.forEach(idx => {
        const rowIndex = idx + 1; 
        const r = data[idx];
        const rStall = String(r[2]).trim();
        const rElec = parseFloat(r[7]||0);
        const rStallPrice = parseFloat(r[8]||0);
        const rStorage = parseFloat(r[15]||0);
        
        let newRowTotal = 0;
        let isMovingRow = (rStall === String(currentStall).trim());

        if (isMovingRow) {
            let noteStr = r[12];
            sheet.getRange(rowIndex, 2).setValue(newDateSheetFmt); 
            sheet.getRange(rowIndex, 3).setValue(targetStallName); 
            sheet.getRange(rowIndex, 9).setValue(realNewStallPrice); 
            
            // New Total Cost
            newRowTotal = realNewStallPrice + rElec + rStorage;
            sheet.getRange(rowIndex, 10).setValue(newRowTotal); 
            
            if (currentStall !== targetStallName) {
                sheet.getRange(rowIndex, 13).setValue(`${noteStr} [ย้าย ${currentStall}->${targetStallName}]`);
            }
        } 
    });

    // Record Payment if diff > 0
    if (paymentData && paymentData.amount > 0) {
        ServiceFinance.recordPayment(
            bookingId, 
            "ส่วนต่างย้ายล็อค", 
            paymentData.amount, 
            paymentData.method, 
            `ย้าย ${currentStall} ไป ${targetStallName}`, 
            officerName,
            paymentData.breakdown
        );
    } else {
        ServiceFinance.updateBookingStatus(bookingId);
    }
    
    return { success: true, message: "ย้ายล็อคเรียบร้อย" };
  }
};