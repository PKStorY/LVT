/**
 * ------------------------------------------------------------------
 * SERVICE: FINANCE
 * Update: Support Slip URL
 * ------------------------------------------------------------------
 */

const ServiceFinance = {
  // บันทึกรับเงิน (รับ breakdown object และ billType และ slipUrl)
  recordPayment: function(bookingId, category, amount, method, note, officer, breakdown = {}, billType = "General", slipUrl = "") {
    // บันทึกโดยแยกประเภทลง Centralized Transactions
    RepoTransaction.addTransaction(bookingId, category, amount, method, note, officer, breakdown, billType, slipUrl);
    
    // อัปเดตสถานะใน Booking Sheet (Daily)
    this.updateBookingStatus(bookingId);
    
    return { success: true };
  },

  calculateTotalPaidSafe: function(bookingId, currentStatus, currentTotalCost) {
      const txnTotal = RepoTransaction.getTotalPaid(bookingId);
      if (txnTotal > 0) return txnTotal;
      // Fallback for old data logic
      if (currentStatus === "ชำระแล้ว" || currentStatus === "ชำระรายวัน") return currentTotalCost; 
      return 0;
  },

  updateBookingStatus: function(bookingId) {
    const sheet = RepoDaily.getSheet();
    const data = sheet.getDataRange().getValues();
    
    let groupTotalCost = 0;
    const groupIndices = [];
    
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === bookingId || data[i][14] === bookingId) {
            groupTotalCost += parseFloat(data[i][9] || 0); 
            groupIndices.push(i + 1); 
        }
    }
    
    if (groupIndices.length === 0) return;

    const firstRowIdx = groupIndices[0] - 1;
    const currentStatus = data[firstRowIdx][11];
    
    const totalPaid = this.calculateTotalPaidSafe(bookingId, currentStatus, groupTotalCost);
    
    let newStatus = "ค้างชำระ";
    if (totalPaid >= (groupTotalCost - 1)) { 
        newStatus = "ชำระแล้ว";
    }
    
    groupIndices.forEach(rowIndex => {
        sheet.getRange(rowIndex, 12).setValue(newStatus);
    });
  }
};