/**
 * ------------------------------------------------------------------
 * CONTROLLER MAIN
 * ฟังก์ชันส่วนกลาง และ Authentication
 * Update: Check Email from Firebase instead of Username
 * ------------------------------------------------------------------
 */

function checkLogin(email) {
  const ssSetup = SpreadsheetApp.openById(SHEET_ID_SETUP);
  const sheetRole = ssSetup.getSheetByName("Role");
  const data = sheetRole.getDataRange().getValues();
  
  // Loop check email in Sheet
  // Structure: Email(A), Pass(B-Ignored), Name(C), Role(D), Status(E), EmpID(F)
  for (let i = 1; i < data.length; i++) { 
    // Check Email (Case Insensitive) and Status
    const dbEmail = String(data[i][0]).trim().toLowerCase();
    const inputEmail = String(email).trim().toLowerCase();
    
    if (dbEmail === inputEmail && data[i][4] === "เปิด") { 
      
      const name = data[i][2];
      const role = data[i][3];
      const employeeId = data[i][5];

      // บันทึก Log
      if (typeof ServiceLog !== 'undefined') {
          ServiceLog.recordAccess(email, name, role, "Login (Google)", "Success");
      }

      return { 
        success: true, 
        name: name, 
        role: role,
        employeeId: employeeId 
      }; 
    } 
  }
  
  // Log Failed
  if (typeof ServiceLog !== 'undefined') {
      ServiceLog.recordAccess(email, "-", "-", "Login (Google)", "Failed: Not Registered or Disabled");
  }
  
  return { success: false, message: "อีเมลนี้ไม่มีสิทธิ์เข้าใช้งานระบบ หรือบัญชีถูกระงับ" };
}