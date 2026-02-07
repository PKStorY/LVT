/**
 * ------------------------------------------------------------------
 * REPOSITORY: DAILY SHEET (SAFE MODE)
 * Update: Added "ALL" mode to bypass date filter
 * ------------------------------------------------------------------
 */

const RepoDaily = {
  getSheet: function() {
    return SpreadsheetApp.openById(SHEET_ID_DAILY).getSheetByName("Bookings");
  },

  getAllBookings: function() {
    const sheet = this.getSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];
    return sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  },

  getMapDataRaw: function(dateStr) {
    const data = this.getAllBookings();
    
    // DEBUG MODE: If "ALL", skip filtering
    if (dateStr === "ALL") {
        return data.map(row => this._mapRow(row, "ALL"));
    }

    const targetDate = this.normalizeDate(dateStr); 
    
    return data.filter(row => {
      const rowDateVal = row[1]; 
      if (!rowDateVal) return false;
      if (row[11] === "ลา") return false; 
      
      const rowDateFmt = this.normalizeDate(rowDateVal);
      return rowDateFmt === targetDate;
    }).map(row => this._mapRow(row, targetDate));
  },

  _mapRow: function(row, dateStr) {
      return {
          id: row[0], 
          date: dateStr, 
          stallName: row[2], bookerName: row[3],
          product: row[4], type: row[5], elecUnit: row[6], elecPrice: row[7],
          stallPrice: row[8], totalPrice: row[9], paymentMethod: row[10],
          status: row[11], note: row[12], 
          paidAmount: parseFloat(row[9] || 0),
          masterId: row[14], 
          storageFee: parseFloat(row[15] || 0) 
      };
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

  deleteRowsOptimized: function(sheet, rowsToDelete) {
    if (rowsToDelete.length === 0) return;
    rowsToDelete.sort((a, b) => b - a);
    let currentBlockStart = rowsToDelete[0];
    let currentBlockEnd = rowsToDelete[0];
    for (let i = 1; i < rowsToDelete.length; i++) {
      const row = rowsToDelete[i];
      if (row === currentBlockEnd - 1) {
        currentBlockEnd = row;
      } else {
        const numRows = currentBlockStart - currentBlockEnd + 1;
        sheet.deleteRows(currentBlockEnd, numRows);
        currentBlockStart = row;
        currentBlockEnd = row;
      }
    }
    const numRows = currentBlockStart - currentBlockEnd + 1;
    sheet.deleteRows(currentBlockEnd, numRows);
  },

  deleteById: function(bookingId) {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getValues(); 
    const rowsToDelete = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(bookingId) || (data[i][14] && String(data[i][14]) === String(bookingId))) {
        rowsToDelete.push(i + 1); 
      }
    }
    this.deleteRowsOptimized(sheet, rowsToDelete);
  },

  deleteFutureBookings: function(bookingId, refDateObj) {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getValues();
    const rowsToDelete = [];
    const compareTime = new Date(refDateObj);
    compareTime.setHours(0,0,0,0);
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(bookingId) || (data[i][14] && String(data[i][14]) === String(bookingId))) {
          const rowDate = new Date(data[i][1]);
          rowDate.setHours(0,0,0,0);
          if (rowDate.getTime() >= compareTime.getTime()) {
              rowsToDelete.push(i + 1);
          }
      }
    }
    this.deleteRowsOptimized(sheet, rowsToDelete);
  },

  saveBatch: function(rows) {
    if (rows.length > 0) {
      const sheet = this.getSheet();
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
  },
  
  setStatusLeave: function(bookingId) {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getValues();
    let found = false;
    const rangesToUpdate = [];
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(bookingId) || (data[i][14] && String(data[i][14]) === String(bookingId))) {
            rangesToUpdate.push(i + 1);
            found = true;
        }
    }
    if (rangesToUpdate.length > 0) {
        rangesToUpdate.forEach(r => sheet.getRange(r, 12).setValue("ลา"));
    }
    return found;
  }
};