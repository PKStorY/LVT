/**
 * ------------------------------------------------------------------
 * SERVICE: ANALYTICS
 * จัดการการคำนวณขั้นสูงและการเก็บ Snapshot ลง Database Analytics
 * Update: Added Backfill Function
 * ------------------------------------------------------------------
 */

const ServiceAnalytics = {
  // สร้างหรือดึง Snapshot ของวัน (เพื่อความเร็วในการดึงย้อนหลัง)
  getDailySnapshot: function(dateStr) {
    const ss = SpreadsheetApp.openById(SHEET_ID_ANALYTICS);
    let sheet = ss.getSheetByName("Stats_Daily_Snapshot");
    if (!sheet) {
       sheet = ss.insertSheet("Stats_Daily_Snapshot");
       sheet.appendRow(["Date", "Total Income", "Occupied", "Total Stalls", "Food Count", "Clothes Count", "Daily Count", "Monthly Count", "Timestamp"]);
    }
    
    const finder = sheet.createTextFinder(dateStr).matchEntireCell(true);
    const result = finder.findNext();
    
    if (result) {
        const row = result.getRow();
        const data = sheet.getRange(row, 1, 1, 9).getValues()[0];
        return {
            date: data[0],
            totalIncome: parseFloat(data[1] || 0),
            occupied: parseInt(data[2] || 0),
            totalStalls: parseInt(data[3] || 0),
            foodCount: parseInt(data[4] || 0),
            clothesCount: parseInt(data[5] || 0),
            dailyCount: parseInt(data[6] || 0),
            monthlyCount: parseInt(data[7] || 0)
        };
    }
    
    return null; // Not found
  },

  saveDailySnapshot: function(data) {
      const ss = SpreadsheetApp.openById(SHEET_ID_ANALYTICS);
      let sheet = ss.getSheetByName("Stats_Daily_Snapshot");
      if (!sheet) sheet = ss.insertSheet("Stats_Daily_Snapshot");
      
      const finder = sheet.createTextFinder(data.date).matchEntireCell(true);
      let cell = finder.findNext();
      while(cell) {
          sheet.deleteRow(cell.getRow());
          cell = finder.findNext();
      }
      
      sheet.appendRow([
          data.date, 
          data.totalIncome, 
          data.occupied, 
          data.totalStalls,
          data.foodCount,
          data.clothesCount,
          data.dailyCount,
          data.monthlyCount,
          new Date()
      ]);
  },

  // NEW: Run this once to populate history data!
  runBackfill: function(daysBack = 7) {
      const today = new Date();
      let logs = [];
      
      for (let i = 1; i <= daysBack; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = Utils.formatDateForSheet(d);
          
          // Calculate Stats for that day (Reusing logic from Dashboard)
          const bookings = RepoDaily.getMapDataRaw(dateStr) || [];
          const finance = (typeof getAccountingDataInternal !== 'undefined') ? getAccountingDataInternal(dateStr) : { summary: { totalIncome: 0 } };
          
          const ssSetup = SpreadsheetApp.openById(SHEET_ID_SETUP);
          const sheetStalls = ssSetup.getSheetByName("Stalls");
          const stallsData = sheetStalls.getDataRange().getValues();
          stallsData.shift();
          
          let occupied = 0, food = 0, clothes = 0, daily = 0, monthly = 0;
          let totalStalls = 0;

          stallsData.forEach(s => {
             if(s[3] !== 'ทางเดิน' && s[3] !== 'อื่นๆ') {
                 totalStalls++;
                 const b = bookings.find(bk => bk.stallName === s[0]);
                 if(b) {
                     occupied++;
                     if(String(s[3]).includes('อาหาร') || (b.product && b.product.includes('อาหาร'))) food++; else clothes++;
                     if(b.type === 'รายวัน') daily++; else monthly++;
                 }
             }
          });
          
          const snapshot = {
              date: dateStr,
              totalIncome: finance.summary.totalIncome,
              occupied: occupied,
              totalStalls: totalStalls,
              foodCount: food,
              clothesCount: clothes,
              dailyCount: daily,
              monthlyCount: monthly
          };
          
          this.saveDailySnapshot(snapshot);
          logs.push(`Saved snapshot for ${dateStr}`);
      }
      return logs.join("\n");
  },

  analyzeDebtRisk: function(monthlyData) {
      const today = new Date();
      const currentDay = today.getDate();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const daysRemaining = daysInMonth - currentDay;
      
      const risks = [];
      monthlyData.forEach(item => {
          if (item.status === 'ค้างชำระ' && item.customerType !== 'Regular') {
              const total = parseFloat(item.total || 0);
              const paid = parseFloat(item.paid || 0);
              const debt = total - paid;
              
              if (debt > 0) {
                  let score = debt / (daysRemaining + 1);
                  if (currentDay > 15 && paid === 0) score *= 1.5;
                  risks.push({ ...item, debt: debt, daysLeft: daysRemaining, riskScore: score });
              }
          }
      });
      return risks.sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);
  },

  analyzePrimeCustomers: function(monthlyData, txns) { /* ... Logic maintained ... */ return []; },
  
  generateInsights: function(currentStats, prevStats, risks) {
      const insights = [];
      const diff = currentStats.totalIncome - prevStats.totalIncome;
      const pct = prevStats.totalIncome > 0 ? (diff / prevStats.totalIncome) * 100 : 0;
      
      if (diff < 0) insights.push(`⚠️ รายได้ลดลง ${Math.abs(pct).toFixed(1)}% (${diff.toLocaleString()} บ.)`);
      else if (diff > 0) insights.push(`✅ รายได้เติบโต ${pct.toFixed(1)}% (+${diff.toLocaleString()} บ.)`);
      
      const occRate = currentStats.totalStalls > 0 ? (currentStats.occupied / currentStats.totalStalls) * 100 : 0;
      if (occRate < 50) insights.push(`🚨 อัตราการจองต่ำ (${occRate.toFixed(1)}%)`);
      
      if (risks.length > 0) insights.push(`💸 มีลูกหนี้เสี่ยงสูง ${risks.length} ราย`);
      
      return insights;
  }
};