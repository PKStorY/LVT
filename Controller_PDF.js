/**
 * ------------------------------------------------------------------
 * CONTROLLER: PDF
 * API สำหรับการสร้าง PDF (แยกไฟล์ตาม Modular Rule)
 * ------------------------------------------------------------------
 */

function saveTicketToDrive(htmlContent, bookingId, folderName) {
  try {
    const folderId = TICKET_FOLDER_ID; // จาก Config.gs
    const folder = DriveApp.getFolderById(folderId);
    const fileName = `Ticket_${bookingId}.pdf`;
    
    // ตรวจสอบและลบไฟล์เดิม (Overwrite)
    const files = folder.getFilesByName(fileName);
    while (files.hasNext()) {
      files.next().setTrashed(true);
    }
    
    // สร้าง HTML Wrapper สำหรับ PDF
    const fullHtml = `
      <html>
        <head>
          <style>
            body { font-family: 'Sarabun', sans-serif; padding: 20px; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;
    
    const blob = Utilities.newBlob(fullHtml, MimeType.HTML).getAs(MimeType.PDF);
    blob.setName(fileName);
    
    folder.createFile(blob);
    
    return { success: true, message: "บันทึก PDF เรียบร้อย" };
    
  } catch (e) {
    console.error("PDF Save Error: " + e.toString());
    return { success: false, message: e.toString() };
  }
}