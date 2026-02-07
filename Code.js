/**
 * ------------------------------------------------------------------
 * MAIN ENTRY POINT
 * จุดเริ่มต้นการทำงานของ Web App และ Helper Functions
 * Update: Added Page Routing (Index vs Dashboard)
 * ------------------------------------------------------------------
 */

// ไปที่ไฟล์ Code.gs แล้วแก้ไขฟังก์ชัน doGet

function doGet(e) {
  var page = e.parameter.page;
  if (page == 'Dashboard') {
     // ตรงนี้ปล่อยผ่านเลย ไม่มีการเช็คว่าใครเป็นคนเรียก
     return HtmlService.createTemplateFromFile('Dashboard').evaluate()

  } else if (page == 'Register') { // <--- เพิ่มส่วนนี้ครับ
      return HtmlService.createTemplateFromFile('Liff_Register')
          .evaluate()
          .setTitle('ลงทะเบียนสมาชิก')
          .addMetaTag('viewport', 'width=device-width, initial-scale=1')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } else {
    // --- กรณีหน้าปกติ (หน้าจองล็อค) ---
    var template = HtmlService.createTemplateFromFile('Index'); // หรือชื่อไฟล์หลักของคุณ
    return template.evaluate()
        .setTitle('จองล็อคตลาดนัดลาดสวายวินเทจ')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

// ฟังก์ชันสำหรับแทรกไฟล์ HTML อื่นๆ (CSS, JS) เข้าไปใน Index
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ฟังก์ชันดึง URL ของ Web App (สำหรับทำ Link เปิดหน้าใหม่)
function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}