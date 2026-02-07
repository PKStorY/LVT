/**
 * ------------------------------------------------------------------
 * SERVICE: CALCULATOR
 * คำนวณวัน, ราคา และเตรียมข้อมูลสำหรับบันทึก
 * Update: Accept preloadedStallsData for Batch Optimization
 * ------------------------------------------------------------------
 */

const ServiceCalc = {
  // คำนวณรายการย่อย (Target Entries) จากฟอร์ม
  // FIX: เพิ่ม param "preloadedStallsData" เพื่อไม่ต้องอ่าน Sheet ทุกครั้งที่เรียก (สำหรับ Batch Job)
  calculateEntries: function(formObject, stallList, preloadedStallsData = null) {
    let stallsData;
    
    if (preloadedStallsData) {
        stallsData = preloadedStallsData;
    } else {
        const ssSetup = SpreadsheetApp.openById(SHEET_ID_SETUP);
        const sheetStalls = ssSetup.getSheetByName("Stalls");
        stallsData = sheetStalls.getDataRange().getValues();
    }
    
    const customerType = formObject.customerType || "Standard";
    let targetEntries = [];
    
    // Use Set to track unique active days across ALL stalls for electricity calculation
    const activeDatesSet = new Set();

    // --- CASE 1: Monthly Booking ---
    if (formObject.rentType === "รายเดือน") {
        const startDate = new Date(formObject.date);
        const y = startDate.getFullYear();
        const m = startDate.getMonth();
        const lastDay = new Date(y, m + 1, 0).getDate();

        // Check Full Package (Wed+Sat+Sun)
        const allSelectedDays = new Set();
        stallList.forEach(s => { if(s.days) s.days.forEach(d => allSelectedDays.add(parseInt(d))); });
        const isGlobalFullPackage = allSelectedDays.has(0) && allSelectedDays.has(3) && allSelectedDays.has(6);

        stallList.forEach((stallItem) => {
            const stallName = stallItem.name;
            const stallInfo = stallsData.find(r => r[0] == stallName);
            
            if (!stallInfo) return;

            // Price Config from Setup Sheet
            const priceWed = parseFloat(stallInfo[4] || 0);
            const priceSat = parseFloat(stallInfo[5] || 0);
            const priceSun = parseFloat(stallInfo[6] || 0);
            const priceMonth = parseFloat(stallInfo[7] || 0);

            for (let d = startDate.getDate(); d <= lastDay; d++) {
                let checkDate = new Date(y, m, d);
                let dayOfWeek = checkDate.getDay();
                
                if (stallItem.days && stallItem.days.includes(dayOfWeek)) {
                    let priceThisDay = 0;
                    
                    // --- PRICING LOGIC ---
                    if (customerType === 'Regular') {
                         if (dayOfWeek === 3) priceThisDay = priceWed;
                         else if (dayOfWeek === 6) priceThisDay = priceSat;
                         else if (dayOfWeek === 0) priceThisDay = priceSun;
                    } 
                    else if (isGlobalFullPackage && priceMonth > 0) { 
                        // Standard (Full Package): ใช้ราคาเหมา
                        priceThisDay = priceMonth; 
                    } else {
                        // Standard (Normal): คิดราคาตามวัน
                        if (dayOfWeek === 3) priceThisDay = priceWed;
                        else if (dayOfWeek === 6) priceThisDay = priceSat;
                        else if (dayOfWeek === 0) priceThisDay = priceSun;
                    }
                    
                    // VIP: ฟรีค่าที่
                    if (customerType === 'VIP') priceThisDay = 0;

                    // Add date string to Set to count unique market days later
                    const dateKey = Utils.formatDateForSheet(checkDate);
                    activeDatesSet.add(dateKey);
                    
                    targetEntries.push({ 
                        date: checkDate, 
                        price: priceThisDay, 
                        stallNameOverride: stallName, 
                        dateKey: dateKey 
                    });
                }
            }
        });
        
        // --- POST PROCESS: Assign includeElec flag ---
        const dateProcessedForElec = new Set();
        targetEntries.forEach(entry => {
            if (!dateProcessedForElec.has(entry.dateKey)) {
                entry.includeElec = true;
                dateProcessedForElec.add(entry.dateKey);
            } else {
                entry.includeElec = false;
            }
        });

    } 
    // --- CASE 2: Daily Booking ---
    else {
        const reqDate = new Date(formObject.date);
        targetEntries = stallList.map((s, index) => ({ 
            date: reqDate, 
            price: parseFloat(s.price || 0), 
            stallNameOverride: s.name, 
            includeElec: (index === 0) 
        }));
        // Daily case: active days = 1
        activeDatesSet.add("DAILY"); 
    }
    
    return { entries: targetEntries, totalMonthlyDays: activeDatesSet.size };
  }
};