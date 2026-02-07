/**
 * ------------------------------------------------------------------
 * CONTROLLER: EXPENSE
 * Business Logic สำหรับรายจ่าย
 * ------------------------------------------------------------------
 */

function addSystemExpense(formObj) {
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(5000);
        
        // Handle Receipt Upload (Optional)
        let receiptUrl = "";
        if (formObj.receiptFile) {
             try {
                const folder = DriveApp.getFolderById(SLIP_FOLDER_ID); // Use same folder as slips
                const decoded = Utilities.base64Decode(formObj.receiptFile.split(',')[1]);
                const blob = Utilities.newBlob(decoded, formObj.receiptType, `Receipt_${Utils.getTimestamp()}`);
                receiptUrl = folder.createFile(blob).getUrl();
             } catch(e) { console.error("Receipt Upload Error", e); }
        }

        const expenseData = {
            date: formObj.date,
            category: formObj.category,
            item: formObj.item,
            amount: parseFloat(formObj.amount),
            method: formObj.method,
            officer: formObj.officer,
            receiptUrl: receiptUrl
        };

        const id = RepoExpense.addExpense(expenseData);
        return { success: true, message: "บันทึกรายจ่ายเรียบร้อย", id: id };

    } catch (e) {
        return { success: false, message: e.toString() };
    } finally {
        lock.releaseLock();
    }
}