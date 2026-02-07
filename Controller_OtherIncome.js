/**
 * ------------------------------------------------------------------
 * CONTROLLER: OTHER INCOME
 * Business Logic สำหรับรายรับอื่นๆ
 * ------------------------------------------------------------------
 */

function addSystemIncome(formObj) {
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(5000);
        
        let proofUrl = "";
        if (formObj.proofFile) {
             try {
                const folder = DriveApp.getFolderById(SLIP_FOLDER_ID);
                const decoded = Utilities.base64Decode(formObj.proofFile.split(',')[1]);
                const blob = Utilities.newBlob(decoded, formObj.proofType, `IncomeProof_${Utils.getTimestamp()}`);
                proofUrl = folder.createFile(blob).getUrl();
             } catch(e) { console.error("Proof Upload Error", e); }
        }

        const incomeData = {
            date: formObj.date,
            category: formObj.category,
            description: formObj.description,
            amount: parseFloat(formObj.amount),
            method: formObj.method,
            officer: formObj.officer,
            proofUrl: proofUrl
        };

        const id = RepoOtherIncome.addIncome(incomeData);
        return { success: true, message: "บันทึกรายรับอื่นๆ เรียบร้อย", id: id };

    } catch (e) {
        return { success: false, message: e.toString() };
    } finally {
        lock.releaseLock();
    }
}