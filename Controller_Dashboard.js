/**
 * ------------------------------------------------------------------
 * CONTROLLER: DASHBOARD (STANDALONE VERSION)
 * แก้ปัญหาข้อมูลไม่มา: อ่านข้อมูลจาก Sheet โดยตรงในไฟล์นี้
 * Update: Refined Logic for Prime Customers & Debt Risks (Transaction Based)
 * Update: Enhanced Zone Stats & Insights (Daily Zone comparison)
 * Update: Sort Debt Risks by Percent Descending & Calculate Paid Percent
 * Update: Change Deadline to 20th of Month (Strict Logic)
 * Update: Add Weekly Milestone Penalties (Week 1 > 35%, Week 2 > 55%, Week 3 > 95%)
 * Update: FIX ReferenceError daysInMonthTotal
 * ------------------------------------------------------------------
 */

// IDs (Hardcoded for safety in this file)
const _DASH_SHEET_ID_SETUP = "1ax7ZepRoNfh564sF6gcyCWcNW80kY04Phc1CjoaCfbo";
const _DASH_SHEET_ID_DAILY = "1R6bNYPRo6yjDtgoazddobauTgvQVQdxA1n67C10L-4I";
const _DASH_SHEET_ID_MONTHLY = "1b6kBbOTfWqGHw9nyJikRCv7kvqml-7H-ZcgIMUtUniE";
const _DASH_SHEET_ID_FINANCE = "1Xp-QrcyR-f5AnRcfOO7nb-sLoneqK31zI1daQgCmNrU";
const _DASH_SHEET_ID_EXPENSE = "1ztblw2nOmvmh5wLcejaN8Zqvsw-UtGXk6K49uxQhm1Q";
const _DASH_SHEET_ID_OTHER = "17SCdtDC6UwqKCHxZ1Xn7uLDFWysZZhBWssLYpq6ckvg";

function getDashboardData(dateStr) {
  const lock = LockService.getScriptLock();
  try {
      lock.waitLock(5000); 
      
      // 1. จัดการวันที่ (Local Helper)
      let targetDateStr = "";
      if (dateStr && dateStr !== "NO_DATE") {
          targetDateStr = _dashNormalizeDate(dateStr); 
      } else {
          targetDateStr = _dashNormalizeDate(new Date());
      }
      
      // คำนวณวันที่สัปดาห์ก่อน (Prev Week)
      const [y, m, d] = targetDateStr.split('-').map(Number);
      const currDateObj = new Date(y, m - 1, d);
      const prevDateObj = new Date(currDateObj.getTime() - (7 * 24 * 60 * 60 * 1000));
      const prevDateStr = _dashNormalizeDate(prevDateObj);

      console.log(`Dashboard Query: Current=${targetDateStr}, Prev=${prevDateStr}`);

      // 2. ดึงข้อมูลดิบจาก Sheet โดยตรง (Direct Fetch)
      const stalls = _dashFetchStallsDirect();
      const dailyBookings = _dashFetchDailyDirect(targetDateStr);
      const prevBookings = _dashFetchDailyDirect(prevDateStr);
      
      // 3. ดึงข้อมูลการเงิน (Direct Fetch) - เฉพาะของวันนั้นๆ
      const currentAccounting = _dashCalculateFinanceDirect(targetDateStr);
      const prevAccounting = _dashCalculateFinanceDirect(prevDateStr);
      
      // 4. ดึงข้อมูล Transaction ทั้งหมดเพื่อเทียบยอด (NEW)
      const transactionMap = _dashFetchTransactionMap();

      // 5. คำนวณสถิติ (Stats Calculation)
      let totalStalls = 0;
      let occupied = 0;
      
      // Detailed Zone Stats
      let zoneStats = { 
          dailyFood: 0, dailyClothes: 0, 
          monthlyFood: 0, monthlyClothes: 0 
      };
      
      const bookingMap = {};
      dailyBookings.forEach(b => bookingMap[String(b.stallName).trim()] = b);

      if (stalls) {
          stalls.forEach(s => {
              // กรองทางเดิน/อื่นๆ ออก
              if(s.type !== 'ทางเดิน' && s.type !== 'อื่นๆ') {
                  totalStalls++;
                  const booking = bookingMap[String(s.name).trim()];
                  if (booking) {
                      occupied++;
                      // Determine Zone (Food vs Clothes)
                      const isFood = String(s.type).includes('อาหาร') || (booking.product && String(booking.product).includes('อาหาร'));
                      
                      // Determine Type (Daily vs Monthly)
                      const isDaily = booking.type === 'รายวัน';

                      if (isDaily) {
                          if (isFood) zoneStats.dailyFood++; else zoneStats.dailyClothes++;
                      } else {
                          if (isFood) zoneStats.monthlyFood++; else zoneStats.monthlyClothes++;
                      }
                  }
              }
          });
      }

      // คำนวณยอดจองสัปดาห์ก่อน (เพื่อทำ Insights)
      let prevOccupied = 0;
      let prevZoneStats = { dailyFood: 0, dailyClothes: 0 };
      const prevBookingMap = {};
      prevBookings.forEach(b => prevBookingMap[String(b.stallName).trim()] = b);
      
      if (stalls) {
          stalls.forEach(s => { 
             if(s.type !== 'ทางเดิน' && s.type !== 'อื่นๆ') {
                 const booking = prevBookingMap[String(s.name).trim()];
                 if (booking) {
                     prevOccupied++; 
                     // Check breakdown for Daily bookings only (for insights)
                     if (booking.type === 'รายวัน') {
                         const isFood = String(s.type).includes('อาหาร') || (booking.product && String(booking.product).includes('อาหาร'));
                         if (isFood) prevZoneStats.dailyFood++; else prevZoneStats.dailyClothes++;
                     }
                 }
             }
          });
      }
      
      // Data Objects
      const prevStats = {
          totalIncome: prevAccounting.summary.totalIncome,
          occupied: prevOccupied,
          totalStalls: totalStalls
      };

      const currentStats = {
          totalIncome: currentAccounting.summary.totalIncome,
          occupied: occupied,
          totalStalls: totalStalls,
          foodCount: zoneStats.dailyFood + zoneStats.monthlyFood,
          clothesCount: zoneStats.dailyClothes + zoneStats.monthlyClothes,
          dailyCount: zoneStats.dailyFood + zoneStats.dailyClothes,
          monthlyCount: zoneStats.monthlyFood + zoneStats.monthlyClothes,
          dailyFoodCount: zoneStats.dailyFood,
          dailyClothesCount: zoneStats.dailyClothes,
          monthlyFoodCount: zoneStats.monthlyFood,
          monthlyClothesCount: zoneStats.monthlyClothes
      };

      // 6. ข้อมูลรายเดือน (Monthly & Analytics)
      const monthlyRaw = _dashFetchMonthlyDirect();
      const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
      
      const currentMonthIndex = currDateObj.getMonth();
      const currentMonthName = thaiMonths[currentMonthIndex];
      const currentYear = currDateObj.getFullYear();
      const currentYearTH = String(currentYear + 543);
      
      const currentMonthBookings = [];
      
      if (monthlyRaw && monthlyRaw.length > 0) {
          monthlyRaw.forEach(row => {
              let mStr = String(row[13] || "").trim(); 
              mStr = mStr.replace(/\s+/g, ' '); 
              
              let isMatch = false;
              if (mStr.includes(currentMonthName) && mStr.includes(currentYearTH)) {
                  isMatch = true;
              } else {
                  const startDateRaw = row[2];
                  if (startDateRaw) {
                      let dateObj = null;
                      if (startDateRaw instanceof Date) {
                          dateObj = startDateRaw;
                      } else {
                          const dateNorm = _dashNormalizeDate(startDateRaw);
                          if (dateNorm) {
                              const [y, m, d] = dateNorm.split('-').map(Number);
                              dateObj = new Date(y, m - 1, d);
                          }
                      }
                      if (dateObj && dateObj.getFullYear() === currentYear && dateObj.getMonth() === currentMonthIndex) {
                          isMatch = true;
                      }
                  }
              }

              if (isMatch) {
                  const bookingId = String(row[0]).trim();
                  const realPaid = transactionMap[bookingId] ? transactionMap[bookingId].totalPaid : 0;
                  const paymentHistory = transactionMap[bookingId] ? transactionMap[bookingId].history : [];

                  currentMonthBookings.push({
                      id: bookingId,
                      name: row[3],
                      stalls: row[4],
                      product: row[5],
                      status: String(row[6] || "").trim(),
                      total: parseFloat(String(row[8]).replace(/,/g,'') || 0),
                      paid: realPaid, 
                      paymentHistory: paymentHistory, 
                      customerType: row[16] || "Standard"
                  });
              }
          });
      }

      // --- ANALYTICS LOGIC (ADVANCED RISK SCORING WITH MILESTONES) ---
      const today = new Date();
      
      // FIX: Added definition of daysInMonthTotal back
      const daysInMonthTotal = new Date(currDateObj.getFullYear(), currDateObj.getMonth() + 1, 0).getDate();

      // SET DEADLINE = 20th of the month
      const deadlineDay = 20; 
      
      const currentDayNum = today.getDate();
      const isSunday = (today.getDay() === 0);
      
      let daysRemaining = 0;
      
      // Determine Context
      const selectedMonthStart = new Date(currDateObj.getFullYear(), currDateObj.getMonth(), 1);
      const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      
      if (selectedMonthStart.getTime() === currentMonthStart.getTime()) {
         // Current Month: Countdown to 20th
         daysRemaining = deadlineDay - currentDayNum;
      } else if (selectedMonthStart < currentMonthStart) {
         // Past Month: Definitively Overdue
         daysRemaining = -99; 
      } else {
         // Future Month: Full count
         daysRemaining = deadlineDay;
      }

      // 1. Debt Risks (ติดตามหนี้เร่งด่วน)
      const debtRisks = [];
      currentMonthBookings.forEach(item => {
          const total = item.total || 0;
          const paid = item.paid || 0;
          const debt = total - paid;
          
          const isPending = (item.status && item.status.includes('ค้าง')) || (debt > 1);

          if (isPending && item.customerType !== 'Regular') {
              if (debt > 0) {
                  // --- ADVANCED RISK SCORE FORMULA (Targeting 20th) ---
                  
                  // 1. Risk Score for Sorting (High Debt / Low Days Remaining)
                  let safeDays = daysRemaining;
                  if (safeDays < 0) safeDays = 0;
                  let riskScore = debt * (1 + (10 / (safeDays + 1)));

                  // 2. Risk Percent for Display (0-100%)
                  // Factor A: Time Elapsed (Max 50%) -> Target 20th
                  let timeRatio = 0;
                  if (daysRemaining < 0) {
                      timeRatio = 1.2; // Overdue (Past 20th) -> Boost score
                  } else {
                      timeRatio = currentDayNum / deadlineDay;
                      if (timeRatio > 1) timeRatio = 1;
                  }
                  const timeScore = timeRatio * 50;

                  // Factor B: Debt Ratio (Max 40%)
                  const totalBill = item.total > 0 ? item.total : debt; 
                  let debtRatio = debt / totalBill;
                  if (debtRatio > 1) debtRatio = 1; 
                  const debtScore = debtRatio * 40;

                  // Factor C: Sunday Bonus (Max 10%)
                  const sundayScore = isSunday ? 10 : 0;

                  // Factor D: Inaction Penalty (Bonus 10%) if past 10th and paid 0
                  let penaltyScore = 0;
                  if (currentDayNum > 10 && paid === 0) {
                      penaltyScore = 10;
                  }
                  
                  // Factor E: Weekly Milestones (New Requirement)
                  // สัปดาห์ 1 (>วันที่ 7): ต้อง > 35%
                  // สัปดาห์ 2 (>วันที่ 14): ต้อง > 55%
                  // สัปดาห์ 3 (>วันที่ 21): ต้อง > 95%
                  let milestonePenalty = 0;
                  let milestoneText = "";
                  
                  const paidPercentVal = (paid / totalBill) * 100;
                  
                  if (currentDayNum > 21) {
                      if (paidPercentVal < 95) { milestonePenalty = 40; milestoneText = " + ตกเกณฑ์ W3"; }
                  } else if (currentDayNum > 14) {
                      if (paidPercentVal < 55) { milestonePenalty = 20; milestoneText = " + ตกเกณฑ์ W2"; }
                  } else if (currentDayNum > 7) {
                      if (paidPercentVal < 35) { milestonePenalty = 10; milestoneText = " + ตกเกณฑ์ W1"; }
                  }

                  // Sum up Risk Percent
                  let riskPercent = Math.round(timeScore + debtScore + sundayScore + penaltyScore + milestonePenalty);
                  
                  // Overdue Override (Force Critical)
                  if (daysRemaining < 0) riskPercent = 95 + Math.round(Math.random()*5);
                  if (riskPercent > 100) riskPercent = 100;

                  // Create Explanation
                  const riskBreakdown = `เวลา(${Math.round(timeScore)}) + หนี้(${Math.round(debtScore)})` + 
                                        (sundayScore > 0 ? ` + อาทิตย์(${sundayScore})` : ``) + 
                                        (penaltyScore > 0 ? ` + ไม่จ่าย(${penaltyScore})` : ``) +
                                        milestoneText +
                                        (daysRemaining < 0 ? ` [เลยกำหนด]` : ``);
                  
                  // Calculate Paid Percent
                  let paidPercent = 0;
                  if (totalBill > 0) {
                      paidPercent = Math.round((paid / totalBill) * 100);
                  }
                  
                  const displayText = `${item.name} (${item.product || '-'})`;
                  const displayDays = daysRemaining < 0 ? "เลยกำหนด" : daysRemaining;

                  debtRisks.push({ 
                      ...item, 
                      name: displayText, 
                      debt: debt, 
                      daysLeft: displayDays, 
                      riskScore: riskScore,
                      riskPercent: riskPercent, // Primary Sort Key
                      paidPercent: paidPercent,
                      riskBreakdown: riskBreakdown 
                  });
              }
          }
      });
      
      // Sort by Risk Percent Descending (Highest Risk First)
      debtRisks.sort((a, b) => b.riskPercent - a.riskPercent); 

      // 2. Prime Customers
      const primeCustomers = currentMonthBookings
          .filter(b => b.customerType === 'Standard') 
          .map(b => {
              let earlyPaidAmount = 0;
              if (b.paymentHistory) {
                  b.paymentHistory.forEach(txn => {
                      const txnDay = new Date(txn.date).getDate();
                      if (txnDay <= 5) {
                          earlyPaidAmount += txn.amount;
                      }
                  });
              }
              return { ...b, earlyPaid: earlyPaidAmount };
          })
          .filter(b => b.earlyPaid > 0)
          .sort((a, b) => {
              if (b.earlyPaid !== a.earlyPaid) return b.earlyPaid - a.earlyPaid;
              return b.total - a.total;
          })
          .slice(0, 5) 
          .map(b => ({ name: b.name, totalPaid: b.paid, stalls: b.stalls }));


      // Insights
      const insights = [];
      const diffInc = currentStats.totalIncome - prevStats.totalIncome;
      if (diffInc < 0) insights.push(`รายได้ลดลง ${Math.abs(diffInc).toLocaleString()} บ. เทียบสัปดาห์ก่อน`);
      else if (diffInc > 0) insights.push(`รายได้เพิ่มขึ้น ${diffInc.toLocaleString()} บ. เทียบสัปดาห์ก่อน`);
      
      const diffDailyFood = zoneStats.dailyFood - prevZoneStats.dailyFood;
      if (diffDailyFood !== 0) {
          const type = diffDailyFood > 0 ? "เพิ่มขึ้น" : "ลดลง";
          insights.push(`จองรายวัน (อาหาร) ${type} ${Math.abs(diffDailyFood)} ล็อค เทียบสัปดาห์ก่อน`);
      }

      const diffDailyClothes = zoneStats.dailyClothes - prevZoneStats.dailyClothes;
      if (diffDailyClothes !== 0) {
          const type = diffDailyClothes > 0 ? "เพิ่มขึ้น" : "ลดลง";
          insights.push(`จองรายวัน (เสื้อผ้า) ${type} ${Math.abs(diffDailyClothes)} ล็อค เทียบสัปดาห์ก่อน`);
      }

      const occRate = totalStalls > 0 ? (occupied / totalStalls * 100) : 0;
      if (occRate < 50) insights.push(`อัตราการจองต่ำ (${occRate.toFixed(1)}%)`);

      const dailyRevenue = currentAccounting.summary.totalIncome;
      const forecast = (dailyRevenue > 0) ? (dailyRevenue * daysInMonthTotal) : 0;

      // --- Return Final Data ---
      return { 
          success: true, 
          meta: { queryDate: targetDateStr, prevDate: prevDateStr },
          data: {
              summary: currentAccounting.summary,
              stats: currentStats,
              prevStats: prevStats,
              accounting: currentAccounting,
              analytics: {
                  debtRisks: debtRisks,
                  primeCustomers: primeCustomers,
                  insights: insights,
                  forecast: forecast
              }
          }
      };

  } catch (e) {
      console.error("Dashboard Error: " + e.toString());
      return { success: false, message: "Dashboard Error: " + e.toString() };
  } finally {
      lock.releaseLock();
  }
}

// === LOCAL HELPERS: DIRECT SHEET ACCESS (No External Deps) ===

function _dashNormalizeDate(val) {
    if (!val) return "";
    try {
        if (val instanceof Date) return Utilities.formatDate(val, "GMT+7", "yyyy-MM-dd");
        let s = String(val).trim();
        if (s.includes('T')) s = s.split('T')[0];
        
        let d, m, y;
        if (s.match(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/)) {
            const parts = s.split(/[\/-]/);
            d = parseInt(parts[0]); m = parseInt(parts[1]); y = parseInt(parts[2]);
        } else if (s.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
            const parts = s.split('-');
            y = parseInt(parts[0]); m = parseInt(parts[1]); d = parseInt(parts[2]);
        } else {
            const dt = new Date(val);
            if(!isNaN(dt.getTime())) return Utilities.formatDate(dt, "GMT+7", "yyyy-MM-dd");
            return ""; 
        }
        if (y > 2400) y -= 543;
        return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    } catch (e) { return ""; }
}

function _dashFetchStallsDirect() {
    try {
        const ss = SpreadsheetApp.openById(_DASH_SHEET_ID_SETUP);
        const sheet = ss.getSheetByName("Stalls");
        const data = sheet.getDataRange().getValues();
        data.shift(); // Remove header
        return data.map(row => ({
            name: row[0], row: row[1], col: row[2], type: row[3],
            priceWed: row[4], priceSat: row[5], priceSun: row[6], priceMonth: row[7]
        }));
    } catch(e) { return []; }
}

function _dashFetchDailyDirect(targetDateStr) {
    try {
        const ss = SpreadsheetApp.openById(_DASH_SHEET_ID_DAILY);
        const sheet = ss.getSheetByName("Bookings");
        const data = sheet.getDataRange().getValues();
        const results = [];
        
        for(let i=1; i<data.length; i++) {
            const row = data[i];
            const dateVal = _dashNormalizeDate(row[1]);
            // Check Date & Status != "ลา"
            if (dateVal === targetDateStr && row[11] !== "ลา") {
                results.push({
                    id: row[0],
                    stallName: row[2],
                    bookerName: row[3],
                    product: row[4],
                    type: row[5],
                    status: row[11]
                });
            }
        }
        return results;
    } catch(e) { return []; }
}

function _dashFetchMonthlyDirect() {
    try {
        const ss = SpreadsheetApp.openById(_DASH_SHEET_ID_MONTHLY);
        const sheet = ss.getSheetByName("Monthly_Data");
        const data = sheet.getDataRange().getValues();
        data.shift(); // Header
        return data;
    } catch(e) { return []; }
}

function _dashCalculateFinanceDirect(targetDateStr) {
    let result = {
        incomes: [],
        expenses: [],
        summary: { totalIncome: 0, totalExpense: 0, netProfit: 0, cashIn: 0, transferIn: 0, cashOut: 0, transferOut: 0, netCash: 0 }
    };

    // 1. Transactions
    try {
        const ssTxn = SpreadsheetApp.openById(_DASH_SHEET_ID_FINANCE);
        const sheetTxn = ssTxn.getSheetByName("Transactions");
        const dataTxn = sheetTxn.getDataRange().getValues();
        for(let i=1; i<dataTxn.length; i++) {
            const row = dataTxn[i];
            if (_dashNormalizeDate(row[2]) === targetDateStr) {
                const amt = parseFloat(row[4] || 0);
                const method = row[5];
                result.incomes.push({ 
                    category: row[3], desc: row[6], amount: amt, method: method 
                });
                result.summary.totalIncome += amt;
                if (method === 'Cash') result.summary.cashIn += amt; else result.summary.transferIn += amt;
            }
        }
    } catch(e) {}

    // 2. Other Income
    try {
        const ssInc = SpreadsheetApp.openById(_DASH_SHEET_ID_OTHER);
        const sheetInc = ssInc.getSheetByName("Other_Income");
        const dataInc = sheetInc.getDataRange().getValues();
        for(let i=1; i<dataInc.length; i++) {
            const row = dataInc[i];
            if (_dashNormalizeDate(row[1]) === targetDateStr) {
                const amt = parseFloat(row[4] || 0);
                const method = row[5];
                result.incomes.push({ 
                    category: row[2], desc: row[3], amount: amt, method: method, type: 'Manual' 
                });
                result.summary.totalIncome += amt;
                if (method === 'Cash') result.summary.cashIn += amt; else result.summary.transferIn += amt;
            }
        }
    } catch(e) {}

    // 3. Expenses
    try {
        const ssExp = SpreadsheetApp.openById(_DASH_SHEET_ID_EXPENSE);
        const sheetExp = ssExp.getSheetByName("Expenses");
        const dataExp = sheetExp.getDataRange().getValues();
        for(let i=1; i<dataExp.length; i++) {
            const row = dataExp[i];
            if (_dashNormalizeDate(row[1]) === targetDateStr) {
                const amt = parseFloat(row[4] || 0);
                const method = row[5];
                result.expenses.push({ 
                    category: row[2], item: row[3], amount: amt, method: method 
                });
                result.summary.totalExpense += amt;
                if (method === 'Cash') result.summary.cashOut += amt; else result.summary.transferOut += amt;
            }
        }
    } catch(e) {}

    result.summary.netProfit = result.summary.totalIncome - result.summary.totalExpense;
    result.summary.netCash = result.summary.cashIn - result.summary.cashOut;

    return result;
}

// === NEW HELPER: FETCH ALL TRANSACTIONS (FOR MAP) ===
function _dashFetchTransactionMap() {
    const map = {};
    try {
        const ssTxn = SpreadsheetApp.openById(_DASH_SHEET_ID_FINANCE);
        const sheetTxn = ssTxn.getSheetByName("Transactions");
        const dataTxn = sheetTxn.getDataRange().getValues();
        
        // Skip header
        for(let i=1; i<dataTxn.length; i++) {
            const row = dataTxn[i];
            const ref = String(row[1]).trim(); // Booking Ref
            const dateStr = _dashNormalizeDate(row[2]);
            const amt = parseFloat(row[4] || 0);
            
            if (!map[ref]) map[ref] = { totalPaid: 0, history: [] };
            
            map[ref].totalPaid += amt;
            map[ref].history.push({ date: dateStr, amount: amt });
        }
    } catch(e) { console.warn("Txn Map Error", e); }
    return map;
}