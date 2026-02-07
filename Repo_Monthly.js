/**
 * ------------------------------------------------------------------
 * REPOSITORY: MONTHLY SHEET
 * จัดการข้อมูลในชีท Monthly_Data
 * Update: Removed dependency on old Payments sheet, now accepts value directly
 * ------------------------------------------------------------------
 */

const RepoMonthly = {
  getSheetData: function() {
    const ss = SpreadsheetApp.openById(SHEET_ID_MONTHLY_EXTERNAL);
    let sheet = ss.getSheetByName("Monthly_Data");
    if (!sheet) return [];
    const data = sheet.getDataRange().getDisplayValues();
    data.shift(); 
    return data;
  },

  // (Deprecated) getSheetPayments - No longer used for calculation, kept if needed for reference

  saveBooking: function(rowArray, bookingId) {
    const ss = SpreadsheetApp.openById(SHEET_ID_MONTHLY_EXTERNAL);
    let sheet = ss.getSheetByName("Monthly_Data");
    if (!sheet) {
      sheet = ss.insertSheet("Monthly_Data");
      sheet.appendRow([ "Booking ID", "Timestamp", "Start Date", "Booker Name", "Stalls", "Product", "Status", "Elec Unit", "Total Price", "Paid Amount", "Note", "Payment Method", "Selected Days", "Booking Month", "Phone", "Stall Details", "Customer Type", "Storage Fee", "Renewal Status" ]);
    }
    
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === bookingId) { sheet.deleteRow(i + 1); break; }
    }
    
    sheet.appendRow(rowArray);
  },

  // (Deprecated) savePayment - Moved to RepoTransaction

  // Update: รับค่า totalPaid โดยตรง (คำนวณมาจาก Transactions)
  updateTotalPaidValue: function(bookingId, totalPaid) {
    const ss = SpreadsheetApp.openById(SHEET_ID_MONTHLY_EXTERNAL);
    const sheetMain = ss.getSheetByName("Monthly_Data");
    if (!sheetMain) return;

    const mainData = sheetMain.getDataRange().getValues();
    for (let i = 1; i < mainData.length; i++) {
        if (mainData[i][0] === bookingId) {
            const grandTotal = parseFloat(mainData[i][8] || 0);
            const customerType = mainData[i][16] || "Standard";
            
            let newStatus = "ค้างชำระ";
            if (totalPaid >= (grandTotal - 1)) {
                newStatus = "ชำระแล้ว";
            }
            if (customerType === 'Regular') newStatus = "ชำระรายวัน"; // Keep logic for Regular

            sheetMain.getRange(i + 1, 10).setValue(totalPaid);
            sheetMain.getRange(i + 1, 7).setValue(newStatus);
            break;
        }
    }
  },

  deleteBooking: function(bookingId) {
    const sheet = SpreadsheetApp.openById(SHEET_ID_MONTHLY_EXTERNAL).getSheetByName("Monthly_Data");
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === bookingId) { sheet.deleteRow(i + 1); break; }
    }
  },
  
  toggleRenewal: function(bookingId, status) {
     const sheet = SpreadsheetApp.openById(SHEET_ID_MONTHLY_EXTERNAL).getSheetByName("Monthly_Data");
     const data = sheet.getDataRange().getValues();
     for (let i = 1; i < data.length; i++) {
        if (data[i][0] === bookingId) {
            sheet.getRange(i + 1, 19).setValue(status);
            return true;
        }
     }
     return false;
  }
};