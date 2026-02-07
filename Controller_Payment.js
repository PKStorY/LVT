/**
 * ------------------------------------------------------------------
 * CONTROLLER: PAYMENT OPERATIONS
 * ฟังก์ชันสำหรับการจัดการการเงินและการชำระเงิน
 * FIX: Update saveMonthlyPayment/updatePaymentTransaction to handle custom dates correctly
 * ------------------------------------------------------------------
 */

function saveMonthlyPayment(paymentData) {
    if (paymentData.paymentId) { return updatePaymentTransaction(paymentData); }
    const paymentId = Utils.generatePaymentId();
    const now = new Date();
    let slipUrl = "";
    if (paymentData.slipFile) {
         try {
            const folder = DriveApp.getFolderById(SLIP_FOLDER_ID);
            const decoded = Utilities.base64Decode(paymentData.slipFile.split(',')[1]);
            const blob = Utilities.newBlob(decoded, paymentData.slipType, `Slip_${paymentData.bookingId}_${paymentId}`);
            slipUrl = folder.createFile(blob).getUrl();
         } catch(e) { console.error(e); }
    }
    
    // FIX: Ensure recordDate uses the user-selected date
    const recordDate = paymentData.date ? paymentData.date : Utils.formatDateForSheet(now);
    
    // FIX: Define breakdown for monthly payment (Assign amount to stall category)
    const breakdown = {
        stall: parseFloat(paymentData.amount),
        elec: 0,
        storage: 0
    };

    // FIX: Pass recordDate to addTransaction
    RepoTransaction.addTransaction(
        paymentData.bookingId, 
        "ชำระเพิ่มเติม", 
        paymentData.amount, 
        paymentData.method, 
        paymentData.note, 
        "System", 
        breakdown, 
        "Monthly Rent", 
        slipUrl,
        recordDate // Pass custom date here
    );

    const totalPaid = RepoTransaction.getTotalPaid(paymentData.bookingId);
    RepoMonthly.updateTotalPaidValue(paymentData.bookingId, totalPaid);
    
    return { success: true, message: "บันทึกการชำระเงินเรียบร้อย" };
}

function updatePaymentTransaction(paymentData) {
    // FIX: Extract date from paymentData and pass to RepoTransaction
    const recordDate = paymentData.date ? paymentData.date : null;
    
    const success = RepoTransaction.updateTransaction(
        paymentData.paymentId, 
        paymentData.amount, 
        paymentData.method, 
        paymentData.note,
        recordDate // Pass custom date here
    );
    
    if (success) {
        const totalPaid = RepoTransaction.getTotalPaid(paymentData.bookingId);
        RepoMonthly.updateTotalPaidValue(paymentData.bookingId, totalPaid);
        return { success: true, message: "แก้ไขเรียบร้อย" };
    }
    return { success: false, message: "ไม่พบรายการ" };
}

function deletePaymentTransaction(paymentId, bookingId) {
    const success = RepoTransaction.deleteTransaction(paymentId);
    if (success) {
        const totalPaid = RepoTransaction.getTotalPaid(bookingId);
        RepoMonthly.updateTotalPaidValue(bookingId, totalPaid);
        return { success: true, message: "ลบเรียบร้อย" };
    }
    return { success: false, message: "ไม่พบรายการ" };
}

function getPaymentHistory(bookingId) {
    const transactions = RepoTransaction.getTransactionsByBookingId(bookingId);
    return { success: true, data: transactions };
}