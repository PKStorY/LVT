/**
 * ------------------------------------------------------------------
 * REPOSITORY: TRANSACTION (SAFE MODE)
 * Update: Added "ALL" mode to bypass date filter
 * ------------------------------------------------------------------
 */

const RepoTransaction = {
  getSheet: function() {
    const ss = SpreadsheetApp.openById(SHEET_ID_FINANCE);
    let sheet = ss.getSheetByName("Transactions");
    if (!sheet) {
      sheet = ss.insertSheet("Transactions");
      sheet.appendRow(["Txn ID", "Booking Ref", "Date", "Category", "Total Amount", "Method", "Note", "Officer", "Timestamp", "Stall Amt", "Elec Amt", "Storage Amt", "Bill Type", "Slip URL"]);
    }
    return sheet;
  },

  addTransaction: function(bookingId, category, totalAmount, method, note, officer, breakdown = {}, billType = "General", slipUrl = "", customDate = null) {
    const sheet = this.getSheet();
    const txnId = `TXN-${new Date().getTime()}`; 
    const timestamp = Utils.getTimestamp();
    const dateStr = customDate ? Utils.formatDateForSheet(customDate) : Utils.formatDateForSheet(new Date());

    const stallAmt = breakdown.stall || 0;
    const elecAmt = breakdown.elec || 0;
    const storageAmt = breakdown.storage || 0;

    sheet.appendRow([
      txnId, bookingId, dateStr, category, totalAmount, method, note, officer, timestamp,
      stallAmt, elecAmt, storageAmt, billType, slipUrl 
    ]);
    return txnId;
  },

  getTransactionsByDate: function(dateStr) {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getValues();
    
    // DEBUG MODE: Return all if "ALL"
    if (dateStr === "ALL") {
        const results = [];
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            results.push({
                id: row[0],
                ref: row[1],
                category: row[3],
                amount: typeof row[4] === 'number' ? row[4] : parseFloat(String(row[4]).replace(/,/g,'') || 0),
                method: row[5],
                note: row[6],
                billType: row[12]
            });
        }
        return results;
    }

    const targetDate = this.normalizeDate(dateStr);
    const results = [];
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowDateFmt = this.normalizeDate(row[2]);
        
        if (rowDateFmt === targetDate) {
            results.push({
                id: row[0],
                ref: row[1],
                category: row[3],
                amount: typeof row[4] === 'number' ? row[4] : parseFloat(String(row[4]).replace(/,/g,'') || 0),
                method: row[5],
                note: row[6],
                billType: row[12]
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
  },
  
  getTotalPaid: function(bookingId) {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getValues();
    let total = 0;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(bookingId)) { 
        total += parseFloat(data[i][4] || 0); 
      }
    }
    return total;
  },

  getTransactionsByBookingId: function(bookingId) {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getDisplayValues();
    if (data.length <= 1) return [];
    return data.filter(row => String(row[1]) === String(bookingId)).map(row => {
      let timeStr = "00:00:00";
      if (row[8] && row[8].includes(' ')) timeStr = row[8].split(' ')[1];
      return {
        paymentId: row[0],
        date: row[2], category: row[3], amount: row[4], method: row[5],
        note: row[6], officer: row[7], timestamp: row[8], time: timeStr, 
        billType: row[12], slipUrl: row[13] || ""
      };
    });
  },

  deleteTransaction: function(txnId) {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(txnId)) {
        sheet.deleteRow(i + 1);
        return true;
      }
    }
    return false;
  },

  updateTransaction: function(txnId, amount, method, note, customDate = null) {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(txnId)) {
        if(customDate) {
            const dateStr = Utils.formatDateForSheet(customDate);
            sheet.getRange(i + 1, 3).setValue(dateStr); 
        }
        sheet.getRange(i + 1, 5).setValue(amount); 
        sheet.getRange(i + 1, 6).setValue(method); 
        sheet.getRange(i + 1, 7).setValue(note);    
        return true;
      }
    }
    return false;
  }
};