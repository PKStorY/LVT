/**
 * ------------------------------------------------------------------
 * CONTROLLER: CONFIGURATION
 * จัดการการอ่าน/บันทึก ค่าตั้งค่าระบบ (จากชีต Config)
 * Update: Force read 4 columns & Case-insensitive Key check & Robust Error Handling
 * ------------------------------------------------------------------
 */

function getSystemConfig() {
  const lock = LockService.getScriptLock();
  // Default Config Object (ค่าเริ่มต้นแบบทางการ หากอ่าน Sheet ไม่ได้)
  const config = {
      cutoffTime: "19:00",
      bankName: "ธนาคาร...",
      bankAccNo: "xxx-x-xxxxx-x",
      bankAccName: "บจก. ...",
      debtMsgTemplate: "เรียน ร้าน {name}\nทางตลาดนัดลาดสวายวินเทจขอแจ้งยอดค้างชำระค่าล็อค\nจำนวน {amount} บาท\nรบกวนชำระที่ \n(bank) ธนาคารกสิกรไทย \n(dollar symbol) \nเลขที่บัญชี : 204-1-25235-1 (euro money) \nชื่อบัญชี : บจก. เดอะเบสพัฒนาและธุรกิจ\nเมื่อโอนแล้วรบกวนส่งสลิปเพื่อยืนยัน ขอบคุณครับ"
  };

  try {
      lock.waitLock(2000);
      const ss = SpreadsheetApp.openById(SHEET_ID_SETUP);
      const sheet = ss.getSheetByName("Config");

      if (sheet) {
          const lastRow = sheet.getLastRow();
          if (lastRow > 0) {
              // FIX: บังคับอ่าน 4 คอลัมน์ (A, B, C, D) เพื่อให้มั่นใจว่าได้ข้อมูลคอลัมน์ D ชัวร์ๆ
              const range = sheet.getRange(1, 1, lastRow, 4);
              const data = range.getValues();
              
              // Assuming Row 1 is Header, Data starts from Row 2
              for (let i = 1; i < data.length; i++) {
                  // FIX: แปลงเป็นตัวพิมพ์ใหญ่และตัดช่องว่างซ้ายขวา (Case-Insensitive Match)
                  const key = String(data[i][0]).trim().toUpperCase(); 
                  const valB = data[i][1]; // Column B (Index 1)
                  const valD = data[i][3]; // Column D (Index 3)

                  if (key === 'CUTOFF_TIME') {
                      let timeStr = valB;
                      if (valB instanceof Date) {
                          const h = String(valB.getHours()).padStart(2, '0');
                          const m = String(valB.getMinutes()).padStart(2, '0');
                          timeStr = `${h}:${m}`;
                      }
                      config.cutoffTime = String(timeStr).trim();
                  } else if (key === 'BANK_NAME') {
                      config.bankName = String(valB).trim();
                  } else if (key === 'BANK_ACC_NO') {
                      config.bankAccNo = String(valB).trim();
                  } else if (key === 'BANK_ACC_NAME') {
                      config.bankAccName = String(valB).trim();
                  } else if (key === 'DEBT_MSG_TEMPLATE') {
                      // Requirement: Read from Column D first
                      if (valD && String(valD).trim() !== "") {
                          config.debtMsgTemplate = String(valD).trim();
                      } else if (valB && String(valB).trim() !== "") {
                          // Fallback to B if D is empty
                          config.debtMsgTemplate = String(valB).trim();
                      }
                  }
              }
          }
      }
      return { success: true, data: config };
  } catch (e) {
      // FIX: Return Default Config even on error, to prevent "undefined" on client
      console.error("Config Error: " + e.toString());
      return { success: false, message: e.toString(), data: config };
  } finally {
      lock.releaseLock();
  }
}

function saveSystemConfig(key, value) {
  const lock = LockService.getScriptLock();
  try {
      lock.waitLock(5000);
      const ss = SpreadsheetApp.openById(SHEET_ID_SETUP);
      let sheet = ss.getSheetByName("Config");
      
      if (!sheet) {
          return { success: false, message: "ไม่พบชีต Config กรุณาสร้างชีตก่อน" };
      }
      
      const data = sheet.getDataRange().getValues();
      let found = false;
      const upperKey = String(key).trim().toUpperCase();
      
      // Update existing row
      for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim().toUpperCase() === upperKey) {
              sheet.getRange(i + 1, 2).setValue(value); // Update Col B
              found = true;
              break;
          }
      }
      
      // Append if not found
      if (!found) {
          sheet.appendRow([key, value, "System Setting"]);
      }
      
      return { success: true, message: "บันทึกค่าเรียบร้อย" };
  } catch (e) {
      return { success: false, message: "Error: " + e.toString() };
  } finally {
      lock.releaseLock();
  }
}