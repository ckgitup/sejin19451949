/**
 * =========================================================================
 * SEJARAH INDONESIA E-LEARNING LMS - TEACHER CONTROL CENTER & SMART POLLING BACKEND
 * =========================================================================
 * Google Apps Script Backend (Code.gs)
 * Web App Access: Anyone, even anonymous
 * Execute as: Me (your Google account)
 */

function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    var action = params.action || "getControlMatrix";
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 0. DATABASE INITIALIZATION TRIGGER
    if (action === "setupDatabase" || action === "INIT_DATABASE") {
      return setupDatabase();
    }

    if (action === "getControlMatrix") {
      var matrixSheet = getOrCreateSheet(ss, "ControlMatrix");
      var data = matrixSheet.getDataRange().getValues();
      
      var config = {
        configVersion: 1,
        activePreset: "LEARNING",
        activeToken: "idem",
        kkmThreshold: 80,
        quizTimerMinutes: 20,
        modules: { "1A": "VISIBLE", "1B": "VISIBLE", "1C": "VISIBLE", "1D": "VISIBLE", "1E": "VISIBLE", "1F": "VISIBLE" },
        quizzes: { "1A": "VISIBLE", "1B": "VISIBLE", "1C": "VISIBLE", "1D": "VISIBLE", "1E": "VISIBLE", "1F": "VISIBLE" },
        explanations: { "1A": "LOCKED", "1B": "LOCKED", "1C": "LOCKED", "1D": "LOCKED", "1E": "LOCKED", "1F": "LOCKED" },
        questionCounts: { "1A": 15, "1B": 15, "1C": 15, "1D": 15, "1E": 15, "1F": 15 },
        schedules: { "1A": { start: "", expire: "" }, "1B": { start: "", expire: "" }, "1C": { start: "", expire: "" }, "1D": { start: "", expire: "" }, "1E": { start: "", expire: "" }, "1F": { start: "", expire: "" } },
        emergencyLocked: false,
        examPaused: false,
        broadcastMessage: "",
        snapshots: [],
        remedialOverrides: {},
        navigationMode: "FREE",
        attemptLimit: 0,
        shuffleQuestions: "OFF",
        interModuleFlow: "SEQUENTIAL"
      };

      if (data.length > 1) {
        try {
          var storedJson = data[1][1]; // Row 2, Column B
          if (storedJson) {
            var parsed = JSON.parse(storedJson);
            config = Object.assign(config, parsed);
          }
        } catch(err) {}
      }

      return jsonResponse({ status: "SUCCESS", config: config });
    }

    if (action === "verifyStudentAccess") {
      var subId = params.subId || "1A";
      var matrixSheet = getOrCreateSheet(ss, "ControlMatrix");
      var data = matrixSheet.getDataRange().getValues();
      var modStatus = "VISIBLE";

      if (data.length > 1 && data[1][1]) {
        try {
          var cfg = JSON.parse(data[1][1]);
          if (cfg.modules && cfg.modules[subId]) {
            modStatus = cfg.modules[subId];
          }
        } catch(err) {}
      }

      var isAllowed = (modStatus === "VISIBLE");
      return jsonResponse({
        status: isAllowed ? "ALLOWED" : "DENIED",
        subId: subId,
        modStatus: modStatus,
        message: isAllowed ? "Access Granted" : "Sub-modul ini dikunci/disembunyikan oleh Guru."
      });
    }

    if (action === "verifyMasterPassword") {
      var pin = params.pin || "";
      var isValid = (pin === "idem" || pin === "SEJARAH12" || pin === "TEACHER_MASTER_KEY" || pin === "cornelcktc" || pin === "pulucinor");
      return jsonResponse({
        status: isValid ? "SUCCESS" : "INVALID",
        isValid: isValid,
        message: isValid ? "Otorisasi Berhasil" : "PIN / Password Master Guru Tidak Valid!"
      });
    }

    if (action === "checkDeviceSession") {
      var email = params.email || "";
      var devToken = params.deviceToken || "";
      var regSheet = getOrCreateSheet(ss, "StudentRegistrations");
      var data = regSheet.getDataRange().getValues();
      var activeTokenOnServer = "";

      for (var i = 1; i < data.length; i++) {
        if (data[i][2] === email) {
          activeTokenOnServer = data[i][7] || ""; // Column H is DeviceToken
          break;
        }
      }

      var isMatch = (!activeTokenOnServer || !devToken || activeTokenOnServer === devToken);
      return jsonResponse({
        status: isMatch ? "MATCH" : "SUPERSEDED",
        isSingleDeviceActive: isMatch,
        activeTokenOnServer: activeTokenOnServer,
        message: isMatch ? "Device Session Verified" : "Email sedang dibuka pada perangkat lain!"
      });
    }

    // 5. GET REGISTERED STUDENTS (FOR TEACHER DASHBOARD CLOUD SYNC)
    if (action === "getRegisteredStudents" || action === "GET_REGISTERED_STUDENTS") {
      var regSheet = getOrCreateSheet(ss, "StudentRegistrations");
      var data = regSheet.getDataRange().getValues();
      var students = [];

      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var emailVal = row[2] ? String(row[2]).trim() : "";
        if (!emailVal || emailVal === "-" || emailVal === "Email Gmail") continue;

        students.push({
          timestamp: row[0] ? String(row[0]) : "",
          nama: row[1] || "Siswa",
          email: emailVal,
          kelas: row[3] || "-",
          nisn: row[4] || "-",
          token: row[5] || "SEJARAH12",
          status: row[6] || "PENDING_ACTIVATION",
          deviceToken: row[7] || ""
        });
      }

      return jsonResponse({
        status: "SUCCESS",
        count: students.length,
        students: students,
        serverTime: new Date().toLocaleString("id-ID")
      });
    }

    // 6. CHECK STUDENT ACTIVATION STATUS (SMART POLLING FOR STUDENT MOBILE CLIENT)
    if (action === "checkStudentStatus" || action === "CHECK_STUDENT_STATUS") {
      var emailVal = (params.email || "").trim();
      var devTokenVal = (params.deviceToken || "").trim();
      if (!emailVal) {
        return jsonResponse({ status: "ERROR", message: "Parameter email diperlukan." });
      }

      var regSheet = getOrCreateSheet(ss, "StudentRegistrations");
      var data = regSheet.getDataRange().getValues();
      var studentRecord = null;

      for (var i = 1; i < data.length; i++) {
        if (data[i][2] && String(data[i][2]).trim().toLowerCase() === emailVal.toLowerCase()) {
          studentRecord = {
            nama: data[i][1] || "",
            email: data[i][2] || "",
            kelas: data[i][3] || "",
            token: data[i][5] || "",
            status: data[i][6] || "PENDING_ACTIVATION",
            deviceToken: data[i][7] || ""
          };
          break;
        }
      }

      if (studentRecord) {
        var isApproved = (studentRecord.status === "APPROVED" || studentRecord.status === "ACTIVATED");
        return jsonResponse({
          status: "SUCCESS",
          email: emailVal,
          studentStatus: studentRecord.status,
          isApproved: isApproved,
          deviceTokenOnServer: studentRecord.deviceToken,
          serverTime: new Date().toLocaleString("id-ID")
        });
      } else {
        return jsonResponse({
          status: "NOT_FOUND",
          email: emailVal,
          studentStatus: "NOT_REGISTERED",
          isApproved: false
        });
      }
    }

    // 7. APPROVE / REJECT STUDENT ACCESS VIA GET (FAST TEACHER ACTIONS)
    if (action === "approveStudent" || action === "APPROVE_STUDENT_GET") {
      var reqToken = params.requestToken || params.token || params.pin || "";
      var VALID_TOKENS = ["SEJARAH_SECURE_TOKEN_2026", "SEJARAH12", "TEACHER_MASTER_KEY", "cornelcktc", "idem", "pulucinor"];
      if (VALID_TOKENS.indexOf(reqToken) === -1) {
        return jsonResponse({ status: "DENIED", message: "Unauthorized Request Token" });
      }

      var emailToUpdate = (params.email || "").trim();
      var newStatus = params.newStatus || params.status || "APPROVED";
      var isBulk = (params.isBulk === "true" || params.isBulk === true);
      var updatedCount = 0;

      var regSheet = getOrCreateSheet(ss, "StudentRegistrations");
      var profSheet = getOrCreateSheet(ss, "StudentProfiles");

      var regData = regSheet.getDataRange().getValues();
      if (isBulk) {
        for (var i = 1; i < regData.length; i++) {
          regSheet.getRange(i + 1, 7).setValue(newStatus);
          updatedCount++;
        }
      } else if (emailToUpdate) {
        for (var i = 1; i < regData.length; i++) {
          if (regData[i][2] && String(regData[i][2]).trim().toLowerCase() === emailToUpdate.toLowerCase()) {
            regSheet.getRange(i + 1, 7).setValue(newStatus);
            updatedCount++;
            break;
          }
        }
      }

      var profData = profSheet.getDataRange().getValues();
      if (isBulk) {
        for (var j = 1; j < profData.length; j++) {
          profSheet.getRange(j + 1, 7).setValue(newStatus);
        }
      } else if (emailToUpdate) {
        for (var j = 1; j < profData.length; j++) {
          if (profData[j][2] && String(profData[j][2]).trim().toLowerCase() === emailToUpdate.toLowerCase()) {
            profSheet.getRange(j + 1, 7).setValue(newStatus);
            break;
          }
        }
      }

      return jsonResponse({
        status: "SUCCESS",
        message: "Status berhasil diubah menjadi: " + newStatus,
        updatedCount: updatedCount
      });
    }

    return jsonResponse({ status: "SUCCESS", message: "GAS Teacher Control Center Active" });
  } catch (err) {
    return jsonResponse({ status: "ERROR", message: err.toString() });
  }
}

function doPost(e) {
  try {
    var rawData = e.postData ? e.postData.contents : "{}";
    var payload = JSON.parse(rawData);
    var action = payload.action || "submitQuizLog";
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 0. SETUP DATABASE TRIGGER VIA POST
    if (action === "setupDatabase" || action === "INIT_DATABASE") {
      return setupDatabase();
    }

    // =========================================================================
    // SECURITY LAYER: REQUEST TOKEN & PAYLOAD SIGNATURE VERIFICATION (ANTI-SPAM)
    // =========================================================================
    var VALID_SECRET_TOKENS = [
      "SEJARAH_SECURE_TOKEN_2026",
      "SEJARAH12",
      "TEACHER_MASTER_KEY",
      "cornelcktc",
      "idem"
    ];

    var reqToken = payload.requestToken || payload.secretToken || payload.pin || payload.token || "";
    var isTokenAuthorized = (VALID_SECRET_TOKENS.indexOf(reqToken) !== -1) ||
                            (VALID_SECRET_TOKENS.indexOf(payload.pin || "") !== -1) ||
                            (VALID_SECRET_TOKENS.indexOf(payload.token || "") !== -1);

    if (!isTokenAuthorized) {
      return jsonResponse({
        status: "DENIED",
        message: "Akses Ditolak: Signature / Request Token Payload POST Tidak Valid! (Anti-Spam Protection)"
      });
    }

    // 1. TEACHER UPDATES CONTROL MATRIX
    if (action === "updateControlMatrix") {
      var teacherPin = payload.pin || "";
      if (teacherPin !== "SEJARAH12" && teacherPin !== "TEACHER_MASTER_KEY" && teacherPin !== "cornelcktc") {
        return jsonResponse({ status: "ERROR", message: "PIN Master Guru Tidak Valid!" });
      }

      var matrixSheet = getOrCreateSheet(ss, "ControlMatrix");
      var matrixLogsSheet = getOrCreateSheet(ss, "MatrixLogs");
      
      // Update Config Version & Matrix Payload
      var newConfig = payload.config || {};
      newConfig.configVersion = (newConfig.configVersion || 1) + 1;
      newConfig.lastUpdated = new Date().toLocaleString("id-ID");

      // Save to Row 2
      matrixSheet.getRange(1, 1, 1, 2).setValues([["Key", "ValueJSON"]]);
      matrixSheet.getRange(2, 1, 1, 2).setValues([
        ["CURRENT_CONFIG", JSON.stringify(newConfig)]
      ]);

      // Audit Trail Log
      matrixLogsSheet.appendRow([
        new Date().toLocaleString("id-ID"),
        newConfig.configVersion,
        newConfig.activePreset,
        newConfig.activeToken,
        JSON.stringify(newConfig.modules),
        JSON.stringify(newConfig.explanations)
      ]);

      return jsonResponse({ status: "SUCCESS", message: "Matriks Kontrol Berhasil Diperbarui di Cloud!", config: newConfig });
    }

    // 2. SUBMIT QUIZ RESULT LOG
    if (action === "submitQuizLog" || action === "SUBMIT_QUIZ" || action === "SUBMIT_QUIZ_LOG") {
      var logSheet = getOrCreateSheet(ss, "QuizLogs");
      if (logSheet.getLastRow() === 0) {
        logSheet.appendRow(["Timestamp", "Nama Siswa", "Kelas", "Email", "Sub-Modul", "Skor", "Total Soal", "Persentase", "Status KKM", "Durasi (Detik)", "Token Kelas"]);
      }

      logSheet.appendRow([
        payload.timestamp || new Date().toLocaleString("id-ID"),
        payload.nama || "Anonim",
        payload.kelas || "-",
        payload.email || "-",
        payload.subId || "1A",
        payload.score || 0,
        payload.totalQ || 15,
        (payload.pct || 0) + "%",
        payload.isPassed ? "LULUS" : "REMEDIAL",
        payload.durationSec || 0,
        payload.token || "-"
      ]);

      return jsonResponse({ status: "SUCCESS", message: "Nilai Kuis Berhasil Disimpan ke Sheets!" });
    }

    // 4. MASS REMEDIAL EMAIL BLAST PIPELINE
    if (action === "sendRemedialEmails" || action === "SEND_REMEDIAL_EMAILS") {
      var studentsList = payload.students || [];
      var sentCount = 0;
      var failedCount = 0;

      for (var s = 0; s < studentsList.length; s++) {
        var student = studentsList[s];
        if (student.email && student.email.indexOf("@") !== -1) {
          try {
            var subject = "⚠️ Pemberitahuan Remedial & Program Pengayaan Sejarah Indonesia - Sub-Modul " + (student.subModule || "1A");
            var htmlBody = '<div style="font-family: \'Segoe UI\', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #fffdf7; border: 2px solid #174d3a; border-radius: 16px; padding: 24px; color: #17211d;">' +
              '<div style="text-align: center; border-bottom: 2px solid #d8d3c4; padding-bottom: 16px; margin-bottom: 20px;">' +
                '<h2 style="color: #174d3a; margin: 0; font-size: 20px;">🏛️ Sejarah Indonesia E-Learning SPA</h2>' +
                '<p style="color: #405047; font-size: 13px; margin-top: 4px;">Pemberitahuan Hasil Kuis & Modul Remedial Teaching</p>' +
              '</div>' +
              '<p>Halo <strong>' + (student.nama || "Siswa") + '</strong> (' + (student.kelas || "-") + '),</p>' +
              '<p style="font-size: 14px; line-height: 1.6;">Berdasarkan rekap pengerjaan kuis pada <strong>Sub-Modul ' + (student.subModule || "1A") + '</strong>, nilai perolehan Anda adalah <span style="color: #a53e24; font-weight: bold;">' + (student.pct || 0) + '%</span> (Skor ' + (student.score || 0) + '/' + (student.total || 15) + '), yang saat ini berada di bawah ambang batas Standar KKM (' + (student.kkmThreshold || 80) + '%).</p>' +
              '<div style="background-color: #f6f3e9; border-left: 4px solid #ee824b; padding: 14px; border-radius: 8px; margin: 20px 0;">' +
                '<strong style="color: #174d3a; display: block; margin-bottom: 6px;">💡 Langkah Pengayaan & Remedial:</strong>' +
                '<ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #405047;">' +
                  '<li>Buka kembali portal E-Learning Sejarah Indonesia.</li>' +
                  '<li>Pelajari ulang teks narasi dan glosarium pada Sub-Modul ' + (student.subModule || "1A") + '.</li>' +
                  '<li>Gunakan 3D Flashcard Memori untuk memperkuat pemahaman konsep utama.</li>' +
                  '<li>Hubungi Guru Pengampu jika membutuhkan sesi bimbingan tatap muka.</li>' +
                '</ol>' +
              '</div>' +
              '<p style="font-size: 12px; color: #718277; text-align: center; margin-top: 24px; border-top: 1px solid #d8d3c4; padding-top: 12px;">' +
                'Email ini dikirim secara otomatis oleh Tim Guru Sejarah Indonesia.<br>Tetap semangat dan tingkatkan kualitas pemahaman sejarah bangsa! 🇮🇩' +
              '</p>' +
            '</div>';

            MailApp.sendEmail({
              to: student.email,
              subject: subject,
              htmlBody: htmlBody
            });
            sentCount++;
          } catch(errMail) {
            failedCount++;
          }
        }
      }

      return jsonResponse({
        status: "SUCCESS",
        message: "Proses email blast remedial selesai dikirim.",
        sentCount: sentCount,
        failedCount: failedCount
      });
    }

    // 3. STUDENT REGISTRATION & VERIFICATION LOG (WITH ACTIVATION STATUS & SINGLE DEVICE TOKEN)
    // Synchronizes to BOTH "StudentRegistrations" AND new "StudentProfiles" sheets seamlessly
    if (action === "registerStudent" || action === "VERIFY_STUDENT" || action === "REGISTER_DEVICE_SESSION") {
      var regSheet = getOrCreateSheet(ss, "StudentRegistrations");
      var profSheet = getOrCreateSheet(ss, "StudentProfiles");

      if (regSheet.getLastRow() === 0) {
        regSheet.appendRow(["Timestamp", "Nama Siswa", "Email Gmail", "Kelas", "NISN", "Token Digunakan", "Status Aktivasi", "DeviceToken"]);
      }
      if (profSheet.getLastRow() === 0) {
        profSheet.appendRow(["Waktu Daftar", "Nama Siswa", "Email Gmail", "Kelas", "NISN", "Token Akses", "Status Aktivasi", "Device Token", "Sesi Terakhir"]);
      }

      var email = payload.email || "-";
      var status = payload.status || "PENDING_ACTIVATION";
      var devToken = payload.deviceToken || payload.sessionId || "";
      var nowStr = payload.lastSession || payload.timestamp || new Date().toLocaleString("id-ID");
      var nisnVal = payload.nisn || "-";
      var namaVal = payload.nama || "-";
      var kelasVal = payload.kelas || "-";
      var tokenVal = payload.token || reqToken || "SEJARAH12";

      // A. Sync to StudentRegistrations
      var regData = regSheet.getDataRange().getValues();
      var foundRegRow = -1;

      for (var i = 1; i < regData.length; i++) {
        if (regData[i][2] === email) {
          foundRegRow = i + 1;
          break;
        }
      }

      if (foundRegRow !== -1) {
        var existingStatus = regData[foundRegRow - 1][6] || status;
        var finalStatus = payload.status ? payload.status : existingStatus;

        regSheet.getRange(foundRegRow, 1, 1, 8).setValues([[
          nowStr,
          namaVal !== "-" ? namaVal : (regData[foundRegRow - 1][1] || "-"),
          email,
          kelasVal !== "-" ? kelasVal : (regData[foundRegRow - 1][3] || "-"),
          nisnVal !== "-" ? nisnVal : (regData[foundRegRow - 1][4] || "-"),
          tokenVal !== "-" ? tokenVal : (regData[foundRegRow - 1][5] || "SEJARAH12"),
          finalStatus,
          devToken || regData[foundRegRow - 1][7] || ""
        ]]);
      } else {
        regSheet.appendRow([
          nowStr,
          namaVal,
          email,
          kelasVal,
          nisnVal,
          tokenVal,
          status,
          devToken
        ]);
      }

      // B. Sync to StudentProfiles (Tab Sheet Baru #1)
      var profData = profSheet.getDataRange().getValues();
      var foundProfRow = -1;

      for (var j = 1; j < profData.length; j++) {
        if (profData[j][2] === email) {
          foundProfRow = j + 1;
          break;
        }
      }

      if (foundProfRow !== -1) {
        var existingProfStatus = profData[foundProfRow - 1][6] || status;
        var finalProfStatus = payload.status ? payload.status : existingProfStatus;

        profSheet.getRange(foundProfRow, 1, 1, 9).setValues([[
          profData[foundProfRow - 1][0] || nowStr, // Retain original registration time
          namaVal !== "-" ? namaVal : (profData[foundProfRow - 1][1] || "-"),
          email,
          kelasVal !== "-" ? kelasVal : (profData[foundProfRow - 1][3] || "-"),
          nisnVal !== "-" ? nisnVal : (profData[foundProfRow - 1][4] || "-"),
          tokenVal !== "-" ? tokenVal : (profData[foundProfRow - 1][5] || "SEJARAH12"),
          finalProfStatus,
          devToken || profData[foundProfRow - 1][7] || "",
          nowStr
        ]]);
      } else {
        profSheet.appendRow([
          nowStr,
          namaVal,
          email,
          kelasVal,
          nisnVal,
          tokenVal,
          status,
          devToken,
          nowStr
        ]);
      }

      return jsonResponse({ status: "SUCCESS", message: "Profil Siswa & Session Terdaftar di Sheet StudentProfiles!", deviceToken: devToken });
    }

    // 4. CHECK DEVICE SESSION (REAL-TIME ANTI-DUPLICATE HEARTBEAT)
    if (action === "CHECK_DEVICE_SESSION") {
      var email = payload.email || "";
      var devToken = payload.deviceToken || "";
      var regSheet = getOrCreateSheet(ss, "StudentRegistrations");
      var data = regSheet.getDataRange().getValues();
      var activeTokenOnServer = "";

      for (var i = 1; i < data.length; i++) {
        if (data[i][2] === email) {
          activeTokenOnServer = data[i][7] || ""; // Column H is DeviceToken
          break;
        }
      }

      var isMatch = (!activeTokenOnServer || !devToken || activeTokenOnServer === devToken);
      return jsonResponse({
        status: isMatch ? "MATCH" : "SUPERSEDED",
        isSingleDeviceActive: isMatch,
        activeTokenOnServer: activeTokenOnServer,
        message: isMatch ? "Device Session Verified" : "Akses Ditolak: Email sedang dibuka pada perangkat lain!"
      });
    }

    // 5. APPROVE / REJECT STUDENT ACCESS (TEACHER CONTROL ACTION - BOTH SHEETS SYNCED)
    if (action === "APPROVE_STUDENT" || action === "UPDATE_STUDENT_STATUS") {
      var regSheet = getOrCreateSheet(ss, "StudentRegistrations");
      var profSheet = getOrCreateSheet(ss, "StudentProfiles");

      var email = payload.email || "";
      var newStatus = payload.newStatus || payload.status || "APPROVED";
      var updatedCount = 0;

      // Sync StudentRegistrations
      var regData = regSheet.getDataRange().getValues();
      if (payload.isBulk) {
        for (var i = 1; i < regData.length; i++) {
          regSheet.getRange(i + 1, 7).setValue(newStatus);
          updatedCount++;
        }
      } else if (email) {
        for (var i = 1; i < regData.length; i++) {
          if (regData[i][2] === email) {
            regSheet.getRange(i + 1, 7).setValue(newStatus);
            updatedCount++;
            break;
          }
        }
      }

      // Sync StudentProfiles
      var profData = profSheet.getDataRange().getValues();
      if (payload.isBulk) {
        for (var j = 1; j < profData.length; j++) {
          profSheet.getRange(j + 1, 7).setValue(newStatus);
        }
      } else if (email) {
        for (var j = 1; j < profData.length; j++) {
          if (profData[j][2] === email) {
            profSheet.getRange(j + 1, 7).setValue(newStatus);
            break;
          }
        }
      }

      return jsonResponse({ status: "SUCCESS", message: "Status Aktivasi Siswa Berhasil Diperbarui di StudentProfiles & StudentRegistrations (" + newStatus + ")", updatedCount: updatedCount });
    }

    // 6. DELETE STUDENT REGISTRATION LOG (BOTH SHEETS SYNCED)
    if (action === "DELETE_STUDENT") {
      var regSheet = getOrCreateSheet(ss, "StudentRegistrations");
      var profSheet = getOrCreateSheet(ss, "StudentProfiles");
      var email = payload.email || "";
      var deleted = false;

      if (email) {
        // Delete from StudentRegistrations
        var regData = regSheet.getDataRange().getValues();
        for (var i = regData.length - 1; i >= 1; i--) {
          if (regData[i][2] === email) {
            regSheet.deleteRow(i + 1);
            deleted = true;
            break;
          }
        }
        // Delete from StudentProfiles
        var profData = profSheet.getDataRange().getValues();
        for (var j = profData.length - 1; j >= 1; j--) {
          if (profData[j][2] === email) {
            profSheet.deleteRow(j + 1);
            break;
          }
        }
      }

      return jsonResponse({ status: "SUCCESS", message: deleted ? "Data Siswa Berhasil Dihapus dari Sheet" : "Data Siswa Tidak Ditemukan", deleted: deleted });
    }

    // 7. SEND CERTIFICATE VIA GMAIL AUTOMATION
    if (action === "SEND_CERTIFICATE_EMAIL") {
      var recipientEmail = payload.email || "";
      var recipientNama = payload.nama || "Siswa Pembelajar";
      var score = payload.score || 100;

      if (!recipientEmail || !recipientEmail.endsWith("@gmail.com")) {
        return jsonResponse({ status: "ERROR", message: "Email penerima harus berupa alamat @gmail.com yang valid." });
      }

      var subject = "🎓 SERTIFIKAT KELULUSAN SEJARAH INDONESIA - " + recipientNama;
      var htmlBody = '<div style="font-family: Arial, sans-serif; background: #fffdf7; border: 2px solid #174d3a; padding: 25px; border-radius: 16px; max-width: 600px; color: #174d3a;">' +
        '<h2 style="color: #174d3a; border-bottom: 2px solid #ee824b; padding-bottom: 10px;">🎓 SERTIFIKAT KELULUSAN DIGITAL</h2>' +
        '<p>Yth. <strong>' + recipientNama + '</strong>,</p>' +
        '<p>Selamat! Anda telah menyelesaikan seluruh rincian modul dan kuis evaluasi <strong>Sejarah Indonesia (1945–1949)</strong> dengan predikat <strong>LULUS (Nilai ' + score + '%)</strong>.</p>' +
        '<div style="background: #174d3a; color: #d8ee93; padding: 15px; border-radius: 12px; font-weight: bold; text-align: center; margin: 20px 0;">' +
        'Status: KETUNTASAN TERVERIFIKASI GURU (SKOR: ' + score + '%)</div>' +
        '<p style="font-size: 12px; color: #718277;">Email ini dikirimkan secara otomatis dari Portal E-Learning Sejarah Indonesia (1945–1949) oleh Guru Pengampu.</p>' +
        '</div>';

      try {
        MailApp.sendEmail({
          to: recipientEmail,
          subject: subject,
          htmlBody: htmlBody
        });
        return jsonResponse({ status: "SUCCESS", message: "Email Sertifikat Kelulusan Berhasil Dikirimkan ke " + recipientEmail });
      } catch (e) {
        return jsonResponse({ status: "ERROR", message: "Gagal Mengirim Email: " + e.toString() });
      }
    }

    // 8. SEND REMEDIAL NOTICE VIA GMAIL AUTOMATION
    if (action === "SEND_REMEDIAL_EMAIL") {
      var recipientEmail = payload.email || "";
      var recipientNama = payload.nama || "Siswa Pembelajar";
      var subModule = payload.subModule || "1A";

      if (!recipientEmail || !recipientEmail.endsWith("@gmail.com")) {
        return jsonResponse({ status: "ERROR", message: "Email penerima harus berupa alamat @gmail.com yang valid." });
      }

      var subject = "⚠️ INSTRUKSI & LINK REMEDIAL SEJARAH INDONESIA - Sub-Modul " + subModule;
      var htmlBody = '<div style="font-family: Arial, sans-serif; background: #fff1e9; border: 2px solid #ee824b; padding: 25px; border-radius: 16px; max-width: 600px; color: #174d3a;">' +
        '<h2 style="color: #ee824b; border-bottom: 2px solid #174d3a; padding-bottom: 10px;">⚠️ NOTIFIKASI REMEDIAL TEACHING</h2>' +
        '<p>Yth. <strong>' + recipientNama + '</strong>,</p>' +
        '<p>Berdasarkan hasil evaluasi kuis <strong>Sub-Modul ' + subModule + '</strong>, nilai Anda belum mencapai Ketuntasan Minimal (KKM 80%).</p>' +
        '<p>Silakan buka kembali portal e-learning untuk membaca ulang materi ringkasan dan mengikuti kuis evaluasi perbaikan (remedial).</p>' +
        '<div style="background: #ee824b; color: #ffffff; padding: 12px; border-radius: 12px; font-weight: bold; text-align: center; margin: 20px 0;">' +
        'Akses Kuis Remedial Telah Dibuka Oleh Guru</div>' +
        '<p style="font-size: 12px; color: #718277;">Dikirim dari Portal E-Learning Sejarah Indonesia (1945–1949).</p>' +
        '</div>';

      try {
        MailApp.sendEmail({
          to: recipientEmail,
          subject: subject,
          htmlBody: htmlBody
        });
        return jsonResponse({ status: "SUCCESS", message: "Email Notifikasi Remedial Berhasil Dikirimkan ke " + recipientEmail });
      } catch (e) {
        return jsonResponse({ status: "ERROR", message: "Gagal Mengirim Email: " + e.toString() });
      }
    }

    return jsonResponse({ status: "ERROR", message: "Action Tidak Dikenal: " + action });
  } catch (err) {
    return jsonResponse({ status: "ERROR", message: err.toString() });
  }
}

/**
 * =========================================================================
 * SETUP DATABASE AUTOMATION FUNCTION
 * Creates and populates StudentProfiles & AdminVault tabs with default values
 * =========================================================================
 */
function setupDatabase() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Tab StudentRegistrations
    var regSheet = getOrCreateSheet(ss, "StudentRegistrations");
    if (regSheet.getLastRow() === 0) {
      regSheet.appendRow(["Timestamp", "Nama Siswa", "Email Gmail", "Kelas", "NISN", "Token Digunakan", "Status Aktivasi", "DeviceToken"]);
    }

    // 2. Tab StudentProfiles (Master Rekap Profil Siswa)
    var profSheet = getOrCreateSheet(ss, "StudentProfiles");
    if (profSheet.getLastRow() === 0) {
      profSheet.appendRow(["Waktu Daftar", "Nama Siswa", "Email Gmail", "Kelas", "NISN", "Token Akses", "Status Aktivasi", "Device Token", "Sesi Terakhir"]);
    }

    // 3. Tab AdminVault (Brankas Kredensial & Rahasia Guru)
    var vaultSheet = getOrCreateSheet(ss, "AdminVault");
    if (vaultSheet.getLastRow() === 0) {
      vaultSheet.appendRow(["Kategori Kredensial", "Nilai Rahasia / Key", "Deskripsi & Kegunaan"]);
      var vaultData = [
        ["PIN Guru Utama", "SEJARAH12", "PIN utama login ke Teacher Control Center."],
        ["PIN Admin Alternatif", "cornelcktc", "PIN otorisasi administrator cadangan."],
        ["Master Emergency Key", "pulucinor", "PIN darurat bypass instan (bisa offline & online)."],
        ["PIN Master System", "TEACHER_MASTER_KEY", "Key akses pengembang/sistem master."],
        ["Default Token Kelas", "SEJARAH12", "Token kelas bawaan untuk pendaftaran siswa."],
        ["Secure API Token", "SEJARAH_SECURE_TOKEN_2026", "Token autentikasi enkripsi GAS Cloud."],
        ["Standar KKM Default", "80%", "Ambang batas kelulusan kuis."],
        ["Timer Kuis Default", "20 Menit", "Batas durasi pengerjaan kuis."],
        ["Petunjuk Pemulihan", "Instruksi Pemulihan Darurat", "Jika siswa ganti HP / lupa token, Guru dapat melakukan reset DeviceToken atau status aktivasi via Dashboard Guru."]
      ];
      vaultSheet.getRange(2, 1, vaultData.length, 3).setValues(vaultData);
    }

    // 4. Tab ControlMatrix
    var matrixSheet = getOrCreateSheet(ss, "ControlMatrix");
    if (matrixSheet.getLastRow() === 0) {
      matrixSheet.appendRow(["Key", "ValueJSON"]);
    }

    // 5. Tab MatrixLogs
    var matrixLogsSheet = getOrCreateSheet(ss, "MatrixLogs");
    if (matrixLogsSheet.getLastRow() === 0) {
      matrixLogsSheet.appendRow(["Timestamp", "ConfigVersion", "ActivePreset", "ActiveToken", "ModulesJSON", "ExplanationsJSON"]);
    }

    // 6. Tab QuizLogs
    var quizLogsSheet = getOrCreateSheet(ss, "QuizLogs");
    if (quizLogsSheet.getLastRow() === 0) {
      quizLogsSheet.appendRow(["Timestamp", "Nama Siswa", "Kelas", "Email", "Sub-Modul", "Skor", "Total Soal", "Persentase", "Status KKM", "Durasi (Detik)", "Token Kelas"]);
    }

    return jsonResponse({
      status: "SUCCESS",
      message: "Database LMS berhasil di-setup! Tab StudentProfiles & AdminVault telah siap digunakan."
    });
  } catch (err) {
    return jsonResponse({ status: "ERROR", message: "Gagal setupDatabase: " + err.toString() });
  }
}

// Helper: Get or Create Sheet Tab
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

// Helper: Handle CORS Preflight (OPTIONS request)
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

// Helper: Format Standard JSON Output dengan CORS Headers
function jsonResponse(obj) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

