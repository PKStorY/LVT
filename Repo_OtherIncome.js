/**
 * ------------------------------------------------------------------
 * REPOSITORY: OTHER INCOME
 * Update: Added "ALL" mode to bypass date filter
 * ------------------------------------------------------------------
 */

const RepoOtherIncome = {
  getSheet: function() {
    const ss = SpreadsheetApp.openById(SHEET_ID_OTHER_INCOME);
    let sheet = ss.getSheetByName("Other_Income");
    if (!sheet) {
      sheet = ss.insertSheet("Other_Income");
      sheet.appendRow([
          "Income ID", "Date", "Category", "Payer / Description", 
          "Amount", "Payment Method", "Officer", "Proof URL", "Timestamp"
      ]);
    }
    return sheet;
  },

  addIncome: function(data) {
    const sheet = this.getSheet();
    const id = `INC-${Utils.getTimestamp().replace(/[-: ]/g, "").slice(2,14)}`;
    sheet.appendRow([
        id, data.date, data.category, data.description, data.amount,
        data.method, data.officer, data.proofUrl || "", Utils.getTimestamp()
    ]);
    return id;
  },

  getIncomeByDate: function(dateStr) {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getValues(); 
    
    // DEBUG MODE
    if (dateStr === "ALL") {
        const results = [];
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            results.push({
                id: row[0],
                date: Utils.formatDateForSheet(row[1]),
                category: row[2],
                description: row[3],
                amount: typeof row[4] === 'number' ? row[4] : parseFloat(String(row[4]).replace(/,/g,'') || 0),
                method: row[5],
                officer: row[6],
                proofUrl: row[7],
                timestamp: row[8]
            });
        }
        return results;
    }

    const targetDate = this.normalizeDate(dateStr);
    const results = [];
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowDateFmt = this.normalizeDate(row[1]);

        if (rowDateFmt === targetDate) {
            results.push({
                id: row[0],
                date: rowDateFmt,
                category: row[2],
                description: row[3],
                amount: typeof row[4] === 'number' ? row[4] : parseFloat(String(row[4]).replace(/,/g,'') || 0),
                method: row[5],
                officer: row[6],
                proofUrl: row[7],
                timestamp: row[8]
            });
        }
    }
    return results;
  },

  normalizeDate: function(val) {
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
};