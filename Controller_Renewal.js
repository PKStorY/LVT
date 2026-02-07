/**
 * ------------------------------------------------------------------
 * CONTROLLER RENEWAL
 * จัดการฟังก์ชันการต่ออายุสัญญา (Renew)
 * FIX: Calculate Total Price correctly (Include Elec & Storage)
 * FIX: Filter out "แจ้งออก" status
 * FIX: Improve Collision Check (Check specific days)
 * FIX: Smart Match using Name + Phone to detect renewal
 * FIX: Auto-create Storage record upon renewal if fee exists
 * ------------------------------------------------------------------
 */

function getRenewalCandidates(sourceMonthStr, targetMonthStr) {
  try {
    const ssExternal = SpreadsheetApp.openById(SHEET_ID_MONTHLY_EXTERNAL);
    const sheetMonthly = ssExternal.getSheetByName("Monthly_Data");
    if (!sheetMonthly) return { success: false, message: "ไม่พบฐานข้อมูลรายเดือน", data: [] };
    
    const data = sheetMonthly.getDataRange().getDisplayValues();
    data.shift(); // Remove Header
    
    const allBookings = data.map(row => ({
      id: row[0],
      bookerName: row[3],
      stalls: row[4],
      product: row[5],
      elecUnit: row[7], 
      selectedDays: row[12],
      bookingMonth: row[13],
      phone: row[14],
      stallDetails: row[15],
      customerType: row[16] || "Standard",
      storageFee: row[17], 
      renewalStatus: row[18] 
    }));

    // Filter candidates (Must NOT be "แจ้งออก")
    const candidates = allBookings.filter(b => b.bookingMonth === sourceMonthStr && b.renewalStatus !== "แจ้งออก");
    const existingInTarget = allBookings.filter(b => b.bookingMonth === targetMonthStr);
    
    // Build Detailed Occupied Map (Stall Name -> Set of Days) for conflict check
    const occupiedMap = {}; 
    const dayNameMap = { "อาทิตย์": 0, "พุธ": 3, "เสาร์": 6 };

    existingInTarget.forEach(b => {
      let detailsParsed = false;
      // 1. Try to parse specific stall-day mapping from JSON
      if (b.stallDetails && b.stallDetails !== "" && b.stallDetails !== "undefined") {
          try {
              const details = JSON.parse(b.stallDetails);
              if (Array.isArray(details)) {
                  details.forEach(d => {
                      const sName = d.name.trim();
                      const sDays = d.days || [];
                      if (!occupiedMap[sName]) occupiedMap[sName] = new Set();
                      sDays.forEach(day => occupiedMap[sName].add(parseInt(day)));
                  });
                  detailsParsed = true;
              }
          } catch (e) {}
      }
      // 2. Fallback
      if (!detailsParsed) {
          let bookedDays = [3, 6, 0];
          if (b.selectedDays) {
               bookedDays = b.selectedDays.split(',').map(s => dayNameMap[s.trim()]).filter(d => d !== undefined);
          }
          if (b.stalls) {
              b.stalls.split(',').map(s => s.trim()).forEach(sName => {
                  if (sName) {
                      if (!occupiedMap[sName]) occupiedMap[sName] = new Set();
                      bookedDays.forEach(d => occupiedMap[sName].add(d));
                  }
              });
          }
      }
    });

    const resultList = candidates.map(c => {
      // Determine Candidate's Requested Slots
      let candidateRequests = []; 
      let parsed = false;
      
      if (c.stallDetails && c.stallDetails !== "" && c.stallDetails !== "undefined") {
          try {
              candidateRequests = JSON.parse(c.stallDetails);
              parsed = true;
          } catch(e) {}
      }
      
      if (!parsed) {
          const cDays = c.selectedDays ? c.selectedDays.split(',').map(s => dayNameMap[s.trim()]).filter(d => d !== undefined) : [3,6,0];
          const cStalls = c.stalls ? c.stalls.split(',').map(s => s.trim()) : [];
          cStalls.forEach(s => {
              candidateRequests.push({ name: s, days: cDays });
          });
      }

      let status = "ready"; 
      let remark = "";

      // Check if Customer (Name + Phone) already exists in Target Month
      const alreadyRenewed = existingInTarget.find(ex => {
          const nameMatch = ex.bookerName.trim() === c.bookerName.trim();
          let phoneMatch = true;
          if (c.phone && c.phone.length > 5 && ex.phone && ex.phone.length > 5) {
               const p1 = c.phone.replace(/\D/g,'');
               const p2 = ex.phone.replace(/\D/g,'');
               phoneMatch = (p1 === p2);
          }
          return nameMatch && phoneMatch;
      });

      if (alreadyRenewed) {
          status = "renewed";
          remark = `ต่ออายุแล้ว (อยู่ที่ล็อค ${alreadyRenewed.stalls})`;
      } else {
          // If not renewed, check for Stall Conflict
          for (const req of candidateRequests) {
              const sName = req.name;
              const sDays = req.days || [];
              
              if (occupiedMap[sName]) {
                  const occupiedDays = occupiedMap[sName];
                  const hasConflict = sDays.some(d => occupiedDays.has(d));
                  
                  if (hasConflict) {
                      status = "conflict"; 
                      remark = `ล็อค ${sName} ไม่ว่าง`;
                      break; 
                  }
              }
          }
      }
      
      let defaultDays = [];
      const uniqueDays = new Set();
      candidateRequests.forEach(req => {
          if(req.days) req.days.forEach(d => uniqueDays.add(d));
      });
      defaultDays = Array.from(uniqueDays);
      if (defaultDays.length === 0) defaultDays = [3, 6, 0];

      return {
        originalId: c.id,
        bookerName: c.bookerName,
        stalls: c.stalls,
        product: c.product,
        elecUnit: c.elecUnit, 
        storageFee: c.storageFee,
        phone: c.phone,
        defaultDays: defaultDays, 
        stallDetails: c.stallDetails, 
        customerType: c.customerType,
        status: status,
        remark: remark
      };
    });

    return { success: true, data: resultList };

  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  }
}

function processRenewalBatch(renewalList, targetMonthInfo) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    const ssSetup = SpreadsheetApp.openById(SHEET_ID_SETUP);
    const sheetStalls = ssSetup.getSheetByName("Stalls");
    const stallsData = sheetStalls.getDataRange().getValues(); 
    
    const ssDaily = SpreadsheetApp.openById(SHEET_ID_DAILY);
    const sheetBookings = ssDaily.getSheetByName("Bookings");
    
    const ssExternal = SpreadsheetApp.openById(SHEET_ID_MONTHLY_EXTERNAL);
    let sheetMonthly = ssExternal.getSheetByName("Monthly_Data");
    if (!sheetMonthly) sheetMonthly = ssExternal.insertSheet("Monthly_Data");

    const now = new Date();
    const timestamp = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
    
    const dailyRowsToAdd = [];
    const monthlyRowsToAdd = [];
    
    renewalList.forEach((item) => {
      const detailList = item.stallDetailsObj || [];
      if (detailList.length === 0) return;

      const customerType = item.targetType || "Standard"; 
      
      const yearStr = now.getFullYear().toString().substr(-2);
      const monthStr = (now.getMonth() + 1).toString().padStart(2, '0');
      const rand = Math.floor(Math.random() * 10000);
      const newBookingId = `BK-${yearStr}${monthStr}-${rand}-${Math.floor(Math.random()*100)}`;
      
      const targetYear = parseInt(targetMonthInfo.year);
      const targetMonth = parseInt(targetMonthInfo.month); 
      const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
      
      const elecUnitVal = parseFloat(item.elecUnit || 0);
      const storageFeeVal = parseFloat(item.storageFee || 0); 

      // --- FIX: Create Storage Record if fee exists ---
      if (storageFeeVal > 0) {
          const sDate = new Date(targetYear, targetMonth, 1);
          const eDate = new Date(targetYear, targetMonth + 1, 0);
          
          // Use first stall as reference for storage location
          const mainStallName = detailList.length > 0 ? detailList[0].name : "";
          
          if (mainStallName) {
             ServiceStorage.createStorage({
                stallName: mainStallName,
                ownerName: item.bookerName,
                phone: item.phone,
                note: "ฝากรายเดือน (ต่อสัญญา): " + targetMonthInfo.monthName,
                amount: storageFeeVal,
                customStartDate: sDate,
                customEndDate: eDate,
                bookingId: newBookingId
            });
          }
      }

      let rentTotal = 0;
      
      const allSelectedDays = new Set();
      detailList.forEach(d => d.days.forEach(day => allSelectedDays.add(day)));

      const elecChargedDates = new Set(); 
      const regularDailyIds = {}; 

      // Create Daily Rows
      detailList.forEach((stallDetail, idx) => {
        const stallName = stallDetail.name;
        const sMaster = stallsData.find(r => r[0] == stallName);
        if (!sMaster) return; 
        
        const priceWed = parseFloat(sMaster[4] || 0);
        const priceSat = parseFloat(sMaster[5] || 0);
        const priceSun = parseFloat(sMaster[6] || 0);
        const myDays = stallDetail.days || [];
        
        for (let d = 1; d <= lastDay; d++) {
          let currentD = new Date(targetYear, targetMonth, d);
          let dayOfWeek = currentD.getDay();
          
          if (myDays.includes(dayOfWeek)) {
             let price = 0;
             if (dayOfWeek === 3) price = priceWed;
             else if (dayOfWeek === 6) price = priceSat;
             else if (dayOfWeek === 0) price = priceSun;
             
             if (customerType === 'VIP') price = 0;
             
             rentTotal += price;
             
             let thisElecUnit = 0;
             let thisElecPrice = 0;
             
             const dateKey = currentD.getTime();
             const dateStrKey = Utilities.formatDate(currentD, TIMEZONE, "yyyy-MM-dd");

             if (!elecChargedDates.has(dateKey)) {
                 thisElecUnit = elecUnitVal;
                 thisElecPrice = elecUnitVal * 10;
                 elecChargedDates.add(dateKey); 
             }

             if (customerType === 'Regular') {
                 if (!regularDailyIds[dateStrKey]) {
                     const dayRand = Math.floor(Math.random() * 100000);
                     regularDailyIds[dateStrKey] = `BK-REG-${Utilities.formatDate(currentD, TIMEZONE, "MMdd")}-${dayRand}`;
                 }
                 const dailyId = regularDailyIds[dateStrKey];

                 dailyRowsToAdd.push([
                   dailyId,
                   Utilities.formatDate(currentD, TIMEZONE, "yyyy-MM-dd"),
                   stallName,
                   item.bookerName,
                   item.product,
                   "รายวัน", 
                   thisElecUnit, thisElecPrice, price, (price + thisElecPrice), 
                   "", "ค้างชำระ", `[ลูกค้าประจำ] ต่ออายุ`, timestamp,
                   newBookingId 
                 ]);
             } else {
                 dailyRowsToAdd.push([
                   newBookingId,
                   Utilities.formatDate(currentD, TIMEZONE, "yyyy-MM-dd"),
                   stallName,
                   item.bookerName,
                   item.product,
                   "รายเดือน",
                   thisElecUnit, thisElecPrice, price, (price + thisElecPrice), 
                   "Cash", "ค้างชำระ", "ต่ออายุอัตโนมัติ", timestamp,
                   newBookingId 
                 ]);
             }
          }
        }
      });
      
      const dayNamesMap = {0: "อาทิตย์", 3: "พุธ", 6: "เสาร์"};
      const selectedDaysStr = Array.from(allSelectedDays).sort().map(d => dayNamesMap[d]).join(", ");
      const allStallsStr = detailList.map(d => d.name).join(", ");
      
      const totalElecPrice = elecChargedDates.size * (elecUnitVal * 10);
      let monthlyTotal = rentTotal + totalElecPrice + storageFeeVal;
      
      let monthlyStatus = "ค้างชำระ";
      let monthlyPaid = 0;
      
      if (customerType === 'Regular') {
          monthlyTotal = 0; 
          monthlyStatus = "ชำระรายวัน"; 
      } else if (customerType === 'VIP') {
          monthlyTotal = 0; 
          monthlyStatus = "ชำระแล้ว"; 
      }

      monthlyRowsToAdd.push([
        newBookingId,
        timestamp,
        Utilities.formatDate(new Date(targetYear, targetMonth, 1), TIMEZONE, "yyyy-MM-dd"),
        item.bookerName,
        allStallsStr, 
        item.product,
        monthlyStatus,
        elecUnitVal, 
        monthlyTotal, 
        monthlyPaid, 
        `ต่ออายุอัตโนมัติ [${customerType}]`,
        "Cash",
        selectedDaysStr,
        targetMonthInfo.monthName,
        item.phone,
        JSON.stringify(detailList),
        customerType,
        storageFeeVal, 
        "" 
      ]);
      
    }); 

    if (dailyRowsToAdd.length > 0) {
      const lastRow = sheetBookings.getLastRow();
      sheetBookings.getRange(lastRow + 1, 1, dailyRowsToAdd.length, dailyRowsToAdd[0].length).setValues(dailyRowsToAdd);
    }
    
    if (monthlyRowsToAdd.length > 0) {
      sheetMonthly.getRange(sheetMonthly.getLastRow() + 1, 1, monthlyRowsToAdd.length, monthlyRowsToAdd[0].length).setValues(monthlyRowsToAdd);
    }
    
    return { success: true, message: `ต่ออายุเรียบร้อย ${monthlyRowsToAdd.length} รายการ` };

  } catch (e) {
    return { success: false, message: "Batch Error: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}