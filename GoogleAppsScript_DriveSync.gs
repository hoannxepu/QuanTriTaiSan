/**
 * =========================================================================
 * GOOGLE APPS SCRIPT - BỘ ĐỒNG BỘ DỮ LIỆU ĐÁM MÂY THÁP TÀI SẢN (PRODUCTION)
 * Giải quyết triệt để lỗi:
 *  1. Có nhiều file JSON trùng lặp hoặc file rác (Trash) trên Google Drive.
 *  2. Tự động chọn file mới nhất hoặc ghim cố định 1 File ID duy nhất.
 *  3. Khóa chống xung đột ghi đè đồng thời (ScriptLock).
 *  4. Cung cấp API chẩn đoán kiểm tra tình trạng kết nối (?check=1).
 * =========================================================================
 */

// Tùy chọn 1: Ghim cố định File ID chính xác trên Google Drive (KHUYÊN DÙNG ĐỂ CHỐNG KẾT NỐI SAI 100%)
// Nếu bạn đã có file thaptaisan_database.json trên Drive, lấy ID của nó (chuỗi ký tự trong link file)
// Ví dụ: const PINNED_FILE_ID = "1a2b3c4d5e6f7g8h9i0j...";
// Nếu để trống "", hệ thống sẽ tự động quét và chọn file mới nhất theo tên file bên dưới.
const PINNED_FILE_ID = "";

// Tên file mặc định trên Google Drive
const DATABASE_FILE_NAME = "thaptaisan_database.json";

/**
 * Hàm tìm kiếm và xác định file JSON chính xác nhất trên Drive
 * Loại bỏ file trong thùng rác và sắp xếp theo thời gian cập nhật gần nhất.
 */
function getTargetDatabaseFile() {
  // 1. Nếu có cấu hình PINNED_FILE_ID hoặc Script Property -> Ưu tiên tuyệt đối
  var explicitId = PINNED_FILE_ID;
  if (!explicitId) {
    try {
      explicitId = PropertiesService.getScriptProperties().getProperty("DATABASE_FILE_ID");
    } catch (e) {}
  }

  if (explicitId && explicitId.trim() !== "") {
    try {
      var pinnedFile = DriveApp.getFileById(explicitId.trim());
      if (pinnedFile && !pinnedFile.isTrashed()) {
        return {
          file: pinnedFile,
          mode: "PINNED_ID",
          duplicates: []
        };
      }
    } catch (err) {
      Logger.log("Không tìm thấy file theo PINNED_FILE_ID, chuyển sang tìm theo tên: " + err);
    }
  }

  // 2. Tìm kiếm theo tên file DATABASE_FILE_NAME
  var filesIterator = DriveApp.getFilesByName(DATABASE_FILE_NAME);
  var validFiles = [];

  while (filesIterator.hasNext()) {
    var f = filesIterator.next();
    // Bỏ qua các file đã bị xóa trong Thùng rác (Trash)
    if (!f.isTrashed()) {
      validFiles.push({
        file: f,
        id: f.getId(),
        name: f.getName(),
        lastUpdated: f.getLastUpdated().getTime(),
        lastUpdatedStr: f.getLastUpdated().toISOString(),
        size: f.getSize()
      });
    }
  }

  // Nếu tìm thấy các file hợp lệ: Sắp xếp theo ngày cập nhật mới nhất (giảm dần)
  if (validFiles.length > 0) {
    validFiles.sort(function(a, b) {
      return b.lastUpdated - a.lastUpdated;
    });

    // File đứng đầu là file mới nhất
    var primary = validFiles[0];
    var duplicatesList = validFiles.slice(1).map(function(item) {
      return {
        id: item.id,
        name: item.name,
        lastUpdated: item.lastUpdatedStr,
        size: item.size
      };
    });

    return {
      file: primary.file,
      mode: validFiles.length > 1 ? "SMART_DEDUPLICATED_LATEST" : "SINGLE_MATCH",
      duplicates: duplicatesList
    };
  }

  // 3. Nếu chưa có bất kỳ file nào trên Drive -> Tạo mới 1 file chuẩn ban đầu
  var defaultPayload = JSON.stringify({
    passwords: {},
    users: {},
    created_at: new Date().toISOString(),
    system: "Tháp Tài Sản Cloud Sync"
  }, null, 2);

  var createdFile = DriveApp.createFile(DATABASE_FILE_NAME, defaultPayload, "application/json");
  return {
    file: createdFile,
    mode: "INITIALIZED_NEW",
    duplicates: []
  };
}

/**
 * Xử lý GET Request: Đọc dữ liệu JSON hoặc chạy Chẩn đoán kết nối
 */
function doGet(e) {
  var isCheck = e && e.parameter && (e.parameter.check === "1" || e.parameter.diagnose === "1");

  try {
    var target = getTargetDatabaseFile();
    var file = target.file;
    var content = file.getBlob().getDataAsString("UTF-8");

    // Nếu người dùng hoặc app gọi kiểm tra chẩn đoán (?check=1)
    if (isCheck) {
      var parsedData = {};
      var usersCount = 0;
      var usernames = [];
      try {
        parsedData = JSON.parse(content);
        if (parsedData && parsedData.users) {
          usernames = Object.keys(parsedData.users);
          usersCount = usernames.length;
        }
      } catch (err) {}

      var diagResult = {
        status: "ok",
        message: "Kết nối Google Drive thành công!",
        connectionMode: target.mode,
        connectedFile: {
          id: file.getId(),
          name: file.getName(),
          url: file.getUrl(),
          sizeBytes: file.getSize(),
          lastUpdated: file.getLastUpdated().toISOString(),
          isTrashed: file.isTrashed()
        },
        duplicatesCount: target.duplicates.length,
        duplicateCandidates: target.duplicates,
        stats: {
          usersCount: usersCount,
          usersList: usernames,
          hasPasswords: !!(parsedData && parsedData.passwords)
        },
        serverTimestamp: new Date().toISOString()
      };

      return ContentService.createTextOutput(JSON.stringify(diagResult, null, 2))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Trả về dữ liệu JSON của ứng dụng
    return ContentService.createTextOutput(content)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    var errPayload = {
      status: "error",
      message: "Lỗi đọc file từ Google Drive: " + error.toString(),
      timestamp: new Date().toISOString()
    };
    return ContentService.createTextOutput(JSON.stringify(errPayload))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Xử lý POST Request: Ghi dữ liệu JSON an toàn có Lock chống ghi đè đồng thời
 */
function doPost(e) {
  // Sử dụng ScriptLock để tránh xung đột ghi đè dữ liệu khi 2 thiết bị gửi cùng lúc
  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    // Đợi tối đa 20 giây để lấy lock
    hasLock = lock.tryLock(20000);
    if (!hasLock) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Server bận do đang có tiến trình đồng bộ khác. Vui lòng thử lại sau vài giây."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var postData = "";
    if (e && e.postData && e.postData.contents) {
      postData = e.postData.contents;
    } else {
      throw new Error("Không nhận được dữ liệu (payload rỗng)");
    }

    // Kiểm tra tính hợp lệ của JSON trước khi ghi vào Drive để chống làm hỏng file
    var parsedTest = JSON.parse(postData);
    if (!parsedTest || typeof parsedTest !== "object") {
      throw new Error("Dữ liệu không phải là JSON hợp lệ");
    }

    var target = getTargetDatabaseFile();
    var file = target.file;

    // Ghi đè an toàn
    file.setContent(postData);

    var responsePayload = {
      status: "success",
      message: "Đã lưu dữ liệu an toàn vào Google Drive",
      savedFileId: file.getId(),
      savedFileName: file.getName(),
      lastUpdated: file.getLastUpdated().toISOString(),
      duplicatesDetected: target.duplicates.length
    };

    return ContentService.createTextOutput(JSON.stringify(responsePayload))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Lỗi ghi dữ liệu vào Google Drive: " + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (e) {}
    }
  }
}
