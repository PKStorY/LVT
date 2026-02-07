/**
 * ------------------------------------------------------------------
 * CONTROLLER: DISPATCHER (CORE)
 * ศูนย์กลางการทำงานหลัก (Map, Save Booking)
 * Note: ไฟล์นี้ต้องมีฟังก์ชัน saveBooking ห้ามซ้ำกับไฟล์อื่น
 * ------------------------------------------------------------------
 */

function getMapData(dateStr) {
  const stalls = getStallsDataCached();
  const bookings = RepoDaily.getMapDataRaw(dateStr);
  
  // Safe check for Storage Service
  let storageMap = {};
  if (typeof ServiceStorage !== 'undefined' && typeof ServiceStorage.getActiveStorageMap === 'function') {
      storageMap = ServiceStorage.getActiveStorageMap();
  }
  
  return { stalls: stalls, bookings: bookings, storageMap: storageMap };
}

// Main Save Function
function saveBooking(formObject) {
  const lock = LockService.getScriptLock();
  // FIX: Increased lock wait time to 30 seconds to prevent "System busy" errors
  try { lock.waitLock(30000); } catch (e) { return { success: false, message: "⚠️ ระบบทำงานหนัก กรุณารอสักครู่" }; }

  try {
    const bookingId = formObject.bookingId || Utils.generateBookingId();
    const timestamp = Utils.getTimestamp();
    const customerType = formObject.customerType || "Standard";
    
    let stallList = Utils.parseJsonSafe(formObject.stallListJson, [{ name: formObject.stallName, price: parseFloat(formObject.stallPrice), days: [] }]);

    const calcResult = ServiceCalc.calculateEntries(formObject, stallList);
    const targetEntries = calcResult.entries;
    
    if (targetEntries.length === 0) return { success: false, message: "เงื่อนไขไม่ถูกต้อง (ไม่มีวันลงขาย)" };

    const errorMsg = ServiceValidator.checkCollision(targetEntries, bookingId);
    if (errorMsg) return { success: false, message: errorMsg };

    const isMonthly = (formObject.rentType === "รายเดือน");
    const forceReset = (formObject.forceReset === true); 
    const today = new Date();
    today.setHours(0,0,0,0);

    let existingFutureDatesSet = new Set();
    
    if (isMonthly && !forceReset) {
        const allData = RepoDaily.getAllBookings(); 
        for (let row of allData) {
            if (row[0] === bookingId || (row[14] && row[14] === bookingId)) {
                const rDate = new Date(row[1]);
                rDate.setHours(0,0,0,0);
                if (rDate.getTime() >= today.getTime()) {
                    existingFutureDatesSet.add(rDate.getTime());
                }
            }
        }
    }

    if (!isMonthly || forceReset) {
        RepoDaily.deleteById(bookingId); 
    } else {
        RepoDaily.deleteFutureBookings(bookingId, today); 
    }

    const elecUnitInput = parseFloat(formObject.elecUnit) || 0;
    const storageFeeInput = parseFloat(formObject.storageFee) || 0; 
    
    // --- Enable Storage Creation ---
    if (storageFeeInput > 0) {
        const mainStallName = formObject.stallName || (stallList.length > 0 ? stallList[0].name : "");
        if (mainStallName && typeof ServiceStorage !== 'undefined') {
             let customStart, customEnd;
             if (isMonthly) {
                 const d = new Date(formObject.date);
                 customStart = new Date(d.getFullYear(), d.getMonth(), 1);
                 customEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
             } else {
                 const d = new Date(formObject.date);
                 customStart = d;
                 customEnd = new Date(d); 
             }

             ServiceStorage.createStorage({
                stallName: mainStallName,
                ownerName: formObject.bookerName,
                phone: formObject.phone,
                note: (isMonthly ? "ฝากรายเดือน: " : "ฝากรายวัน: ") + (formObject.note || ""),
                amount: storageFeeInput,
                customStartDate: customStart,
                customEndDate: customEnd,
                bookingId: bookingId 
            });
        }
    }

    let grandTotal = 0;
    const totalAllPrice = targetEntries.reduce((sum, e) => sum + e.price, 0);
    let totalElecPriceAll = (isMonthly) ? (elecUnitInput * 10 * calcResult.totalMonthlyDays) : (elecUnitInput * 10);
    if (customerType === 'VIP') totalElecPriceAll = 0;
    
    // Include Storage Fee in Grand Total
    grandTotal = totalAllPrice + totalElecPriceAll + storageFeeInput;
    
    if (customerType === 'VIP' && formObject.totalPrice) grandTotal = parseFloat(formObject.totalPrice);

    // --- DUPLICATE TRANSACTION PREVENTION ---
    let paidFromForm = parseFloat(formObject.paidAmount || 0);
    
    const existingPaid = RepoTransaction.getTotalPaid(bookingId);
    
    let amountToRecord = paidFromForm - existingPaid;
    amountToRecord = Math.round(amountToRecord * 100) / 100;

    const totalPaidNow = existingPaid + (amountToRecord > 0 ? amountToRecord : 0);
    
    let status = "ค้างชำระ";
    if (grandTotal >= 0 && totalPaidNow >= (grandTotal - 0.01)) status = "ชำระแล้ว";
    if (!formObject.bookerName) status = "ว่าง";
    if (isMonthly && customerType === 'Regular') status = "ค้างชำระ";

    const batchRows = [];
    
    targetEntries.forEach((entry) => {
        const entryDate = new Date(entry.date);
        entryDate.setHours(0,0,0,0);
        const entryTime = entryDate.getTime();
        
        let shouldAdd = false;
        
        if (!isMonthly || forceReset) {
            shouldAdd = true;
        } else {
            if (entryTime < today.getTime()) {
                shouldAdd = false; 
            } else {
                if (existingFutureDatesSet.has(entryTime)) {
                    shouldAdd = true;
                }
            }
        }

        if (shouldAdd) {
            let thisElecUnit = 0;
            let thisElecPrice = 0;
            if (entry.includeElec) { 
                thisElecUnit = elecUnitInput; 
                thisElecPrice = elecUnitInput * 10; 
            }

            let rowId = bookingId;
            let masterId = bookingId;
            
            if (isMonthly && customerType === 'Regular') {
                const dayRand = Math.floor(Math.random() * 100000);
                rowId = `BK-REG-${Utils.formatDateForSheet(entry.date).replace(/-/g,'').substr(4)}-${dayRand}`;
            }

            const rowTotal = entry.price + thisElecPrice; 
            let rowStorageFee = 0;
            if (entry.includeElec) {
                rowStorageFee = storageFeeInput;
            }
            const finalRowTotal = entry.price + thisElecPrice + rowStorageFee;

            let note = formObject.note;
            if (customerType === 'Regular') note = `[ลูกค้าประจำ] ${note || ""}`;

            batchRows.push([ 
                rowId, Utils.formatDateForSheet(entry.date), entry.stallNameOverride, formObject.bookerName, formObject.product, 
                formObject.rentType, thisElecUnit, thisElecPrice, entry.price, finalRowTotal, 
                formObject.paymentMethod, status, note, timestamp,
                masterId,
                rowStorageFee
            ]);
        }
    });

    RepoDaily.saveBatch(batchRows);

    if (isMonthly) {
         const daysMap = {0: "อาทิตย์", 3: "พุธ", 6: "เสาร์"};
         const selectedDaysArr = Utils.parseJsonSafe(formObject.selectedDaysJson, []);
         const selectedDaysStr = selectedDaysArr.map(d => daysMap[d] || "").filter(s => s !== "").join(",");

         const dObj = new Date(formObject.date);
         const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
         const bookingMonthStr = `${thaiMonths[dObj.getMonth()]} ${dObj.getFullYear() + 543}`;

         RepoMonthly.saveBooking([
            bookingId, timestamp, Utils.formatDateForSheet(formObject.date), formObject.bookerName, 
            stallList.map(s=>s.name).join(", "), formObject.product, status, formObject.elecUnit, 
            grandTotal, totalPaidNow, formObject.note, formObject.paymentMethod, 
            selectedDaysStr, bookingMonthStr, formObject.phone || "-", formObject.stallListJson, customerType, storageFeeInput, "" 
         ], bookingId);
    }
    
    if (amountToRecord > 0) {
         const officer = "System"; 
         
         let remainingPay = amountToRecord;
         
         // Priority: Stall > Elec > Storage
         let payStall = 0;
         if (totalAllPrice > 0) {
             payStall = Math.min(totalAllPrice, remainingPay);
             remainingPay -= payStall;
         }
         
         let payElec = 0;
         if (totalElecPriceAll > 0) {
             payElec = Math.min(totalElecPriceAll, remainingPay);
             remainingPay -= payElec;
         }
         
         let payStorage = 0;
         if (storageFeeInput > 0) {
             payStorage = Math.min(storageFeeInput, remainingPay);
             remainingPay -= payStorage;
         }
         
         if (remainingPay > 0) {
             payStall += remainingPay;
         }

         const breakdown = {
             stall: payStall,
             elec: payElec,
             storage: payStorage
         };
         
         const totalTransactionValue = amountToRecord; 
         const billType = isMonthly ? "Monthly Rent" : "Daily Rent";
         
         ServiceFinance.recordPayment(bookingId, "ค่าจอง/ค่าเช่า", totalTransactionValue, formObject.paymentMethod, "ชำระเมื่อจอง/แก้ไข", officer, breakdown, billType);
         
         if (isMonthly) {
             const newTotalPaid = RepoTransaction.getTotalPaid(bookingId);
             RepoMonthly.updateTotalPaidValue(bookingId, newTotalPaid);
         }
    }

    return { success: true, message: "บันทึกข้อมูลเรียบร้อย", id: bookingId, status: status };

  } catch (e) { return { success: false, message: "Error: " + e.toString() }; } finally { lock.releaseLock(); }
}

function deleteBookingById(bookingId) {
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(10000);
        RepoDaily.deleteById(bookingId);
        RepoMonthly.deleteBooking(bookingId);
        return { success: true, message: "ลบข้อมูลเรียบร้อย" };
    } catch(e) { return { success: false, message: e.toString() }; } finally { lock.releaseLock(); }
}

function runArchiveProcess() {
    try {
        const msg = ServiceArchive.runDailyArchive();
        return { success: true, message: msg };
    } catch(e) { return { success: false, message: e.toString() }; }
}