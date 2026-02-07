/**
 * ------------------------------------------------------------------
 * MODULE: LIFF MEMBER REGISTRATION
 * จัดการ Backend สำหรับระบบสมาชิก LINE OA
 * Sheet ID: 1z_fsLP4BsPAD9wu0CzBua1q4-vdPkrQ8W0Pm-e4wlPM
 * ------------------------------------------------------------------
 */

const SHEET_ID_MEMBERS = "1z_fsLP4BsPAD9wu0CzBua1q4-vdPkrQ8W0Pm-e4wlPM";

// ฟังก์ชันรับข้อมูลการลงทะเบียนจากหน้าเว็บ (LIFF)
function registerLineMember(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // รอคิวไม่เกิน 10 วินาที

    const ss = SpreadsheetApp.openById(SHEET_ID_MEMBERS);
    let sheet = ss.getSheetByName("Members");
    
    // ถ้ายังไม่มีชีต ให้สร้างใหม่
    if (!sheet) {
      sheet = ss.insertSheet("Members");
      sheet.appendRow(["LineUserID", "Name", "PictureURL", "ShopName", "Phone", "Status", "RegisteredDate", "Note"]);
    }

    const userId = data.userId;
    const allData = sheet.getDataRange().getValues();
    
    // 1. ตรวจสอบว่าเคยลงทะเบียนไปแล้วหรือยัง?
    let userRowIndex = -1;
    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][0]) === String(userId)) { // Col A: LineUserID
        userRowIndex = i + 1;
        break;
      }
    }

    const timestamp = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

    if (userRowIndex > -1) {
      // กรณีเคยมีแล้ว -> อัปเดตข้อมูล (Update)
      sheet.getRange(userRowIndex, 2).setValue(data.displayName); // Name
      sheet.getRange(userRowIndex, 3).setValue(data.pictureUrl);  // Picture
      sheet.getRange(userRowIndex, 4).setValue(data.shopName);    // ShopName
      sheet.getRange(userRowIndex, 5).setValue(data.phone);       // Phone
      // Status ไม่เปลี่ยน (เผื่อโดน Ban อยู่)
      sheet.getRange(userRowIndex, 7).setValue(timestamp);        // Update time
      
      return { success: true, message: "อัปเดตข้อมูลสมาชิกเรียบร้อยแล้ว", isNew: false };
      
    } else {
      // กรณีใหม่ -> เพิ่มแถวใหม่ (Create)
      sheet.appendRow([
        data.userId,      // A: UserID
        data.displayName, // B: Name
        data.pictureUrl,  // C: Picture
        data.shopName,    // D: ShopName
        data.phone,       // E: Phone
        "Active",         // F: Status
        timestamp,        // G: Date
        ""                // H: Note
      ]);
      
      return { success: true, message: "ลงทะเบียนสมาชิกสำเร็จ", isNew: true };
    }

  } catch (e) {
    return { success: false, message: "Error: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ฟังก์ชันตรวจสอบสถานะสมาชิก (เผื่อใช้ตอนเปิด LIFF มาเช็คว่าเคยลงทะเบียนยัง)
function checkMemberStatus(userId) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID_MEMBERS);
    const sheet = ss.getSheetByName("Members");
    if (!sheet) return { registered: false };

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(userId)) {
        return { 
          registered: true, 
          shopName: data[i][3], 
          phone: data[i][4],
          status: data[i][5]
        };
      }
    }
    return { registered: false };
  } catch (e) {
    return { registered: false, error: e.toString() };
  }
}