/**
 * ------------------------------------------------------------------
 * REPOSITORY: STORAGE
 * จัดการข้อมูลในชีทฝากของ (Storage Sheet)
 * Update: Added findStorageByBookingId and updateStorageFromBooking
 * Update: Added Booking ID to Schema (Col 10 / Index 9)
 * ------------------------------------------------------------------
 */

const RepoStorage = {
  getSheet: function() {
    const ss = SpreadsheetApp.openById(SHEET_ID_STORAGE);
    let sheet = ss.getSheetByName("Storage_Data");
    if (!sheet) {
      sheet = ss.insertSheet("Storage_Data");
      // Header: ID, Stall, Owner, Phone, StartDate, EndDate, Status, Note, Timestamp, RefBookingID
      sheet.appendRow(["Storage ID", "Stall Name", "Owner Name", "Phone", "Start Date", "End Date", "Status", "Note", "Timestamp", "Ref Booking ID"]);
    }
    return sheet;
  },

  getActiveStorage: function() {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getDisplayValues();
    data.shift(); 
    return data.filter(row => row[6] === "Active").map(row => ({
      id: row[0],
      stallName: row[1],
      ownerName: row[2],
      phone: row[3],
      startDate: row[4],
      endDate: row[5],
      status: row[6],
      note: row[7],
      timestamp: row[8],
      refBookingId: row[9] || ""
    }));
  },

  getAllStorageData: function() {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getDisplayValues();
    data.shift(); 
    return data.map(row => ({
      id: row[0],
      stallName: row[1],
      ownerName: row[2],
      phone: row[3],
      startDate: row[4],
      endDate: row[5],
      status: row[6],
      note: row[7],
      timestamp: row[8],
      refBookingId: row[9] || ""
    })).reverse(); 
  },

  saveStorage: function(dataArray) {
    const sheet = this.getSheet();
    sheet.appendRow(dataArray);
  },
  
  // FIX: New Function to find existing active storage for a booking
  findActiveByBookingId: function(bookingId) {
    if (!bookingId) return null;
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
        // Check Ref Booking ID (Col 10, Index 9) and Status (Col 7, Index 6)
        if (String(data[i][9]) === String(bookingId) && data[i][6] === 'Active') {
            return {
                rowIndex: i + 1,
                id: data[i][0]
            };
        }
    }
    return null;
  },
  
  // FIX: Update existing storage record
  updateStorageFromBooking: function(rowIndex, formObj) {
      const sheet = this.getSheet();
      const timestamp = Utils.getTimestamp();
      
      // Update fields that might change from booking
      sheet.getRange(rowIndex, 2).setValue(formObj.stallName); // Stall
      sheet.getRange(rowIndex, 3).setValue(formObj.ownerName); // Owner
      sheet.getRange(rowIndex, 4).setValue(formObj.phone);     // Phone
      sheet.getRange(rowIndex, 8).setValue(formObj.note);      // Note
      sheet.getRange(rowIndex, 9).setValue(timestamp);         // Update timestamp
      
      // Optionally update dates if provided
      if (formObj.customStartDate) sheet.getRange(rowIndex, 5).setValue(Utils.formatDateForSheet(new Date(formObj.customStartDate)));
      if (formObj.customEndDate) sheet.getRange(rowIndex, 6).setValue(Utils.formatDateForSheet(new Date(formObj.customEndDate)));
      
      return true;
  },

  updateStorageLocation: function(storageId, newLocation) {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getValues();
    const nowStr = Utils.formatDateForSheet(new Date()) + " " + Utils.formatTime(new Date());
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === storageId) {
        const oldLocation = data[i][1]; 
        const oldNote = data[i][7];    
        sheet.getRange(i + 1, 2).setValue(newLocation);
        const logMsg = ` [ย้าย ${oldLocation}->${newLocation} เมื่อ ${nowStr}]`;
        sheet.getRange(i + 1, 8).setValue(oldNote + logMsg);
        return true;
      }
    }
    return false;
  },

  moveStorage: function(storageId, newLocation, newStatus) {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === storageId) {
        if (newLocation) sheet.getRange(i + 1, 2).setValue(newLocation); 
        if (newStatus) sheet.getRange(i + 1, 7).setValue(newStatus); 
        return true;
      }
    }
    return false;
  },
  
  completeStorage: function(storageId) {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === storageId) {
        sheet.getRange(i + 1, 7).setValue("Completed");
        return true;
      }
    }
    return false;
  }
};