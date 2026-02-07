/**
 * ------------------------------------------------------------------
 * CONTROLLER: MOVE OPERATIONS
 * API สำหรับการย้ายล็อคและคำนวณส่วนต่าง
 * ------------------------------------------------------------------
 */

function getAvailableStalls(dateStr) {
  try {
    const stalls = ServiceMove.getAvailableStallsForMove(dateStr);
    return { success: true, stalls: stalls };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}

function previewMoveBooking(bookingId, currentStall, newDateStr, newStall) {
  try {
    return ServiceMove.previewMove(bookingId, currentStall, newDateStr, newStall);
  } catch(e) {
    return { success: false, message: "Error: " + e.toString() };
  }
}

function confirmMoveBooking(bookingId, currentStall, newDateStr, newStall, newPrice, paymentData, officerName) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    // Prepare breakdown for payment if exists
    if(paymentData) {
        paymentData.breakdown = { stall: paymentData.amount, elec: 0, storage: 0 };
    }
    return ServiceMove.executeMove(bookingId, currentStall, newDateStr, newStall, newPrice, paymentData, officerName);
  } catch(e) {
    return { success: false, message: "Error: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}