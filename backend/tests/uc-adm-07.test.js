const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'uc_adm_07_test_secret';
const TEST_DB_URI =
  process.env.MONGO_TEST_URI_ADM07 ||
  'mongodb://127.0.0.1:27017/clinic_booking_test_uc_adm_07';

const app = require('../src/app');
const {
  User,
  Specialty,
  DoctorShift,
  AuditLog,
  GroupHealthRequest,
  GroupHealthAssignment,
} = require('../src/models');
const {
  ROLES,
  AUDIT_ACTIONS,
  GROUP_HEALTH_REQUEST_STATUSES,
  GROUP_HEALTH_RESULT_STATUSES,
} = require('../src/constants/enums');
const {
  getGroupHealthBucket,
  GROUP_HEALTH_FILE_PURPOSES,
} = require('../src/utils/groupHealthStorage');

let server;
let baseUrl;
let admin1;
let admin2;
let doctor1;
let doctor2;
let admin1Token;
let admin2Token;
let doctor1Token;
let doctor2Token;
let receptionistToken;

let mainRequest;
let assignment1;
let assignment2;

function uploadBufferToGridFs(filename, buffer, metadata) {
  return new Promise((resolve, reject) => {
    const fileId = new mongoose.Types.ObjectId();
    const stream = getGroupHealthBucket().openUploadStream(filename, {
      id: fileId,
      metadata,
    });
    stream.once('error', reject);
    stream.once('finish', () => resolve(fileId));
    stream.end(buffer);
  });
}

async function apiJson(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, body: json };
}

async function uploadDoctorResultMultipart(token, assignmentId, fileName, mimeType, contentBuffer) {
  const form = new FormData();
  const blob = new Blob([contentBuffer], { type: mimeType });
  form.append('file', blob, fileName);

  const res = await fetch(
    `${baseUrl}/group-health/assignments/${assignmentId}/result`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

describe('UC-ADM-07: Duyệt kết quả khám nhóm', () => {
  before(async () => {
    await mongoose.connect(TEST_DB_URI);
    await mongoose.connection.db.dropDatabase();

    await Specialty.create([
      { id: 1, name: 'Nội tổng quát', description: 'Khám nội tổng quát' },
      { id: 2, name: 'Tim mạch', description: 'Khám chuyên khoa tim mạch' },
    ]);

    const passwordHash = await bcrypt.hash('Test@123', 10);

    admin1 = await User.create({
      email: 'admin1.gh@clinicbooking.com',
      password: passwordHash,
      fullName: 'Admin Duyệt 1',
      userType: ROLES.ADMIN,
      gender: 'Male',
      isEnable: true,
    });

    admin2 = await User.create({
      email: 'admin2.gh@clinicbooking.com',
      password: passwordHash,
      fullName: 'Admin Duyệt 2',
      userType: ROLES.ADMIN,
      gender: 'Female',
      isEnable: true,
    });

    doctor1 = await User.create({
      email: 'doctor1.gh@clinicbooking.com',
      password: passwordHash,
      fullName: 'BS. Nguyễn Văn Nội',
      userType: ROLES.DOCTOR,
      specialtyId: 1,
      gender: 'Male',
      isEnable: true,
    });

    doctor2 = await User.create({
      email: 'doctor2.gh@clinicbooking.com',
      password: passwordHash,
      fullName: 'BS. Trần Thị Tim',
      userType: ROLES.DOCTOR,
      specialtyId: 2,
      gender: 'Female',
      isEnable: true,
    });

    await User.create({
      email: 'recep.gh@clinicbooking.com',
      password: passwordHash,
      fullName: 'Lễ Tân Phòng Khám',
      userType: ROLES.RECEPTIONIST,
      gender: 'Female',
      isEnable: true,
    });

    const shift1 = await DoctorShift.create({
      doctorId: doctor1.id,
      date: '2026-11-15',
      shift: 'MORNING',
      startTime: '08:00',
      endTime: '12:00',
      status: 'GROUP_BLOCKED',
      slots: [],
    });

    const shift2 = await DoctorShift.create({
      doctorId: doctor2.id,
      date: '2026-11-15',
      shift: 'AFTERNOON',
      startTime: '13:00',
      endTime: '17:00',
      status: 'GROUP_BLOCKED',
      slots: [],
    });

    // Create APPROVED GroupHealthRequest + upload source CSV into GridFS
    mainRequest = await GroupHealthRequest.create({
      groupName: 'Công ty Cổ phần FPT Software',
      departments: 'Khối Kỹ thuật & QA (50 nhân sự)',
      phoneNumber: '0901234567',
      preferredDate: '2026-11-15',
      status: GROUP_HEALTH_REQUEST_STATUSES.APPROVED,
      approvedBy: admin1.id,
      approvedAt: new Date(),
    });

    const sourceBuffer = Buffer.from(
      'emp_code,full_name,department\nNV001,Le Van A,Engineering\nNV002,Pham Thi B,QA\n',
      'utf8',
    );
    const sourceFileId = await uploadBufferToGridFs(
      'danh-sach-kham-fpt.csv',
      sourceBuffer,
      {
        purpose: GROUP_HEALTH_FILE_PURPOSES.SOURCE,
        requestId: mainRequest.id,
        contentType: 'text/csv',
      },
    );

    await GroupHealthRequest.updateOne(
      { id: mainRequest.id },
      {
        $set: {
          sourceFileId,
          sourceFileName: 'danh-sach-kham-fpt.csv',
          sourceFileSize: sourceBuffer.length,
          sourceFileMimeType: 'text/csv',
        },
      },
    );

    assignment1 = await GroupHealthAssignment.create({
      requestId: mainRequest.id,
      doctorId: doctor1.id,
      shiftId: shift1.id,
      specialtyId: 1,
      capacityAllocated: 25,
      note: 'Khám Nội tổng quát đợt 1',
      resultStatus: GROUP_HEALTH_RESULT_STATUSES.NONE,
    });

    assignment2 = await GroupHealthAssignment.create({
      requestId: mainRequest.id,
      doctorId: doctor2.id,
      shiftId: shift2.id,
      specialtyId: 2,
      capacityAllocated: 25,
      note: 'Khám Tim mạch đợt 1',
      resultStatus: GROUP_HEALTH_RESULT_STATUSES.NONE,
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api`;
        resolve();
      });
    });

    const loginAs = async (email) => {
      const res = await apiJson('POST', '/auth/login', {
        body: { email, password: 'Test@123' },
      });
      assert.equal(res.status, 200);
      return res.body.data.token;
    };

    admin1Token = await loginAs('admin1.gh@clinicbooking.com');
    admin2Token = await loginAs('admin2.gh@clinicbooking.com');
    doctor1Token = await loginAs('doctor1.gh@clinicbooking.com');
    doctor2Token = await loginAs('doctor2.gh@clinicbooking.com');
    receptionistToken = await loginAs('recep.gh@clinicbooking.com');
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.disconnect();
    }
  });

  it('1. Điều kiện trước: bắt buộc JWT Admin (chặn unauthenticated 401 và Doctor/Receptionist 403)', async () => {
    const noTokenRes = await apiJson('GET', '/admin/group-health/assignments');
    assert.equal(noTokenRes.status, 401);

    const doctorForbidden = await apiJson(
      'POST',
      `/admin/group-health/assignments/${assignment1.id}/approve`,
      { token: doctor1Token, body: { note: 'Tự duyệt' } },
    );
    assert.equal(doctorForbidden.status, 403);

    const recepForbidden = await apiJson('GET', '/admin/group-health/requests', {
      token: receptionistToken,
    });
    assert.equal(recepForbidden.status, 403);
  });

  it('2. Ngoại lệ thiếu file: từ chối duyệt/từ chối khi chưa upload (NONE) hoặc khi file GridFS bị mất', async () => {
    // Assignment 1 is currently NONE
    const approveNoneRes = await apiJson(
      'POST',
      `/admin/group-health/assignments/${assignment1.id}/approve`,
      { token: admin1Token, body: { note: 'Duyệt sớm' } },
    );
    assert.equal(approveNoneRes.status, 409);

    const rejectNoneRes = await apiJson(
      'POST',
      `/admin/group-health/assignments/${assignment1.id}/reject`,
      { token: admin1Token, body: { note: 'Từ chối sớm' } },
    );
    assert.equal(rejectNoneRes.status, 409);

    // Create an isolated request + assignment with UPLOADED status whose GridFS file is missing
    const brokenReq = await GroupHealthRequest.create({
      groupName: 'Công ty Test Thiếu File',
      status: GROUP_HEALTH_REQUEST_STATUSES.APPROVED,
      approvedBy: admin1.id,
      approvedAt: new Date(),
    });
    const ghostFileId = new mongoose.Types.ObjectId();
    const brokenAssignment = await GroupHealthAssignment.create({
      requestId: brokenReq.id,
      doctorId: doctor1.id,
      resultStatus: GROUP_HEALTH_RESULT_STATUSES.UPLOADED,
      resultVersion: 1,
      resultFiles: [
        {
          fileId: ghostFileId,
          version: 1,
          originalName: 'missing-in-gridfs.csv',
          mimeType: 'text/csv',
          size: 64,
          uploadedBy: doctor1.id,
          uploadedAt: new Date(),
          reviewStatus: 'PENDING_ADMIN_REVIEW',
        },
      ],
    });

    const approveMissingStorage = await apiJson(
      'POST',
      `/admin/group-health/assignments/${brokenAssignment.id}/approve`,
      { token: admin1Token, body: { note: 'Thử duyệt file mất' } },
    );
    assert.equal(approveMissingStorage.status, 409);

    const openMissingFile = await fetch(
      `${baseUrl}/admin/group-health/assignments/${brokenAssignment.id}/results/latest`,
      { headers: { Authorization: `Bearer ${admin1Token}` } },
    );
    assert.equal(openMissingFile.status, 404);

    // Ensure brokenReq did NOT transition to COMPLETED
    const reloadedBrokenReq = await GroupHealthRequest.findOne({
      id: brokenReq.id,
    }).lean();
    assert.equal(reloadedBrokenReq.status, GROUP_HEALTH_REQUEST_STATUSES.APPROVED);
  });

  it('3. Luồng chính — Mở file nguồn & file kết quả sau khi Bác sĩ upload (ResultStatus = UPLOADED)', async () => {
    const csvV1 = Buffer.from(
      'emp_code,bp,conclusion\nNV001,120/80,Loai 1\nNV002,,Thieu huyet ap\n',
      'utf8',
    );
    const uploadRes = await uploadDoctorResultMultipart(
      doctor1Token,
      assignment1.id,
      'ket-qua-noi-v1.csv',
      'text/csv',
      csvV1,
    );
    assert.equal(uploadRes.status, 201);
    assert.equal(uploadRes.body.data.resultStatus, 'UPLOADED');

    // Admin filters UPLOADED assignments
    const queueRes = await apiJson(
      'GET',
      `/admin/group-health/assignments?resultStatus=UPLOADED&requestId=${mainRequest.id}`,
      { token: admin1Token },
    );
    assert.equal(queueRes.status, 200);
    assert.equal(queueRes.body.data.length, 1);
    assert.equal(queueRes.body.data[0].id, assignment1.id);
    assert.equal(queueRes.body.data[0].doctorName, 'BS. Nguyễn Văn Nội');

    // Admin opens latest result file inline
    const openResultRes = await fetch(
      `${baseUrl}/admin/group-health/assignments/${assignment1.id}/results/latest?disposition=inline`,
      { headers: { Authorization: `Bearer ${admin1Token}` } },
    );
    assert.equal(openResultRes.status, 200);
    assert.match(
      openResultRes.headers.get('content-disposition') || '',
      /^inline;.*ket-qua-noi-v1\.csv/i,
    );
    assert.match(openResultRes.headers.get('content-type') || '', /text\/csv/i);
    const downloadedResultBytes = Buffer.from(await openResultRes.arrayBuffer());
    assert.deepEqual(downloadedResultBytes, csvV1);

    // Admin opens request source file via assignment endpoint
    const openSourceRes = await fetch(
      `${baseUrl}/admin/group-health/assignments/${assignment1.id}/source`,
      { headers: { Authorization: `Bearer ${admin1Token}` } },
    );
    assert.equal(openSourceRes.status, 200);
    assert.match(
      openSourceRes.headers.get('content-disposition') || '',
      /^attachment;.*danh-sach-kham-fpt\.csv/i,
    );
  });

  it('4. Luồng chính — Reject kèm note: lưu actor/timestamp, giữ tổng request ở APPROVED cho bác sĩ nộp lại', async () => {
    const rejectNote = 'Thiếu chỉ số huyết áp của nhân viên NV002, đề nghị bổ sung';
    const rejectRes = await apiJson(
      'POST',
      `/admin/group-health/assignments/${assignment1.id}/reject`,
      { token: admin1Token, body: { note: rejectNote } },
    );
    assert.equal(rejectRes.status, 200);

    const { assignment: rejectedAssign, request: parentAfterReject } =
      rejectRes.body.data;
    assert.equal(rejectedAssign.resultStatus, GROUP_HEALTH_RESULT_STATUSES.REJECTED);
    assert.equal(rejectedAssign.reviewedBy, admin1.id);
    assert.equal(rejectedAssign.reviewedByName, 'Admin Duyệt 1');
    assert.ok(rejectedAssign.reviewedAt);
    assert.equal(rejectedAssign.reviewNote, rejectNote);

    const fileV1 = rejectedAssign.resultFiles.find((f) => f.version === 1);
    assert.equal(fileV1.reviewStatus, 'REJECTED');
    assert.equal(fileV1.reviewedBy, admin1.id);
    assert.ok(fileV1.reviewedAt);
    assert.equal(fileV1.reviewNote, rejectNote);

    // Parent request remains APPROVED
    assert.equal(parentAfterReject.status, GROUP_HEALTH_REQUEST_STATUSES.APPROVED);
    assert.equal(parentAfterReject.progress.rejectedAssignments, 1);

    // Cannot approve a REJECTED assignment until doctor uploads a new version
    const approveRejectedRes = await apiJson(
      'POST',
      `/admin/group-health/assignments/${assignment1.id}/approve`,
      { token: admin1Token, body: { note: 'Đổi ý duyệt luôn' } },
    );
    assert.equal(approveRejectedRes.status, 409);
  });

  it('5. Ngoại lệ chưa hoàn thành đủ assignment & Approve lặp idempotent (bảo toàn actor/timestamp gốc)', async () => {
    // Doctor 1 uploads corrected v2 PDF
    const pdfV2 = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n', 'utf8');
    const reuploadRes = await uploadDoctorResultMultipart(
      doctor1Token,
      assignment1.id,
      'ket-qua-noi-v2.pdf',
      'application/pdf',
      pdfV2,
    );
    assert.equal(reuploadRes.status, 201);
    assert.equal(reuploadRes.body.data.resultStatus, 'UPLOADED');
    assert.equal(reuploadRes.body.data.resultFiles.length, 2);

    // Admin 1 approves Assignment 1 (v2) while Assignment 2 is still NONE
    const approve1Res = await apiJson(
      'POST',
      `/admin/group-health/assignments/${assignment1.id}/approve`,
      { token: admin1Token, body: { note: 'Bản PDF v2 đầy đủ, đạt chuẩn' } },
    );
    assert.equal(approve1Res.status, 200);
    assert.equal(approve1Res.body.data.idempotent, false);

    const approvedAssign1 = approve1Res.body.data.assignment;
    const partialRequest = approve1Res.body.data.request;

    assert.equal(approvedAssign1.resultStatus, GROUP_HEALTH_RESULT_STATUSES.APPROVED);
    assert.equal(approvedAssign1.resultVersion, 2);
    assert.equal(approvedAssign1.reviewedBy, admin1.id);
    assert.equal(approvedAssign1.reviewedByName, 'Admin Duyệt 1');
    assert.ok(approvedAssign1.reviewedAt);
    assert.equal(approvedAssign1.reviewNote, 'Bản PDF v2 đầy đủ, đạt chuẩn');

    const originalReviewedAt = approvedAssign1.reviewedAt;

    // Parent request MUST NOT complete yet because Assignment 2 is still NONE!
    assert.equal(partialRequest.status, GROUP_HEALTH_REQUEST_STATUSES.APPROVED);
    assert.equal(partialRequest.completedAt, null);
    assert.deepEqual(partialRequest.progress, {
      totalAssignments: 2,
      approvedAssignments: 1,
      uploadedAssignments: 0,
      rejectedAssignments: 0,
      pendingUploadAssignments: 1,
      isAllApproved: false,
    });

    const auditCountBeforeRepeat = await AuditLog.countDocuments({
      action: AUDIT_ACTIONS.GROUP_HEALTH_RESULT_APPROVE,
      targetId: assignment1.id,
    });
    assert.equal(auditCountBeforeRepeat, 1);

    // Wait briefly, then Admin 2 calls approve AGAIN on Assignment 1 -> MUST be idempotent!
    await new Promise((resolve) => setTimeout(resolve, 30));

    const repeatApproveRes = await apiJson(
      'POST',
      `/admin/group-health/assignments/${assignment1.id}/approve`,
      { token: admin2Token, body: { note: 'Duyệt lặp lần 2 bởi Admin 2' } },
    );
    assert.equal(repeatApproveRes.status, 200);
    assert.equal(repeatApproveRes.body.data.idempotent, true);

    // Original actor (admin1) & timestamp & note are strictly preserved!
    const afterRepeatAssign = repeatApproveRes.body.data.assignment;
    assert.equal(afterRepeatAssign.reviewedBy, admin1.id);
    assert.equal(afterRepeatAssign.reviewedAt, originalReviewedAt);
    assert.equal(afterRepeatAssign.reviewNote, 'Bản PDF v2 đầy đủ, đạt chuẩn');

    const fileV2AfterRepeat = afterRepeatAssign.resultFiles.find(
      (f) => f.version === 2,
    );
    assert.equal(fileV2AfterRepeat.reviewedBy, admin1.id);
    assert.equal(fileV2AfterRepeat.reviewedAt, originalReviewedAt);

    // No duplicate audit log created on idempotent repeat
    const auditCountAfterRepeat = await AuditLog.countDocuments({
      action: AUDIT_ACTIONS.GROUP_HEALTH_RESULT_APPROVE,
      targetId: assignment1.id,
    });
    assert.equal(auditCountAfterRepeat, 1);
  });

  it('6. Luồng hoàn tất tổng Request: duyệt phân công cuối chuyển Request sang COMPLETED và lưu đầy đủ AuditLog', async () => {
    // Doctor 2 uploads result for Assignment 2
    const csvDoc2 = Buffer.from(
      'emp_code,ecg,conclusion\nNV001,Normal,Binh thuong\nNV002,Normal,Binh thuong\n',
      'utf8',
    );
    const upload2Res = await uploadDoctorResultMultipart(
      doctor2Token,
      assignment2.id,
      'ket-qua-tim-mach.csv',
      'text/csv',
      csvDoc2,
    );
    assert.equal(upload2Res.status, 201);

    // Before Admin approves Assignment 2, check Request Detail shows 1 APPROVED + 1 UPLOADED (still APPROVED)
    const detailBeforeFinal = await apiJson(
      'GET',
      `/admin/group-health/requests/${mainRequest.id}`,
      { token: admin2Token },
    );
    assert.equal(detailBeforeFinal.status, 200);
    assert.equal(
      detailBeforeFinal.body.data.status,
      GROUP_HEALTH_REQUEST_STATUSES.APPROVED,
    );
    assert.equal(detailBeforeFinal.body.data.progress.uploadedAssignments, 1);

    // Admin 2 approves Assignment 2 via unified review endpoint (or /approve)
    const approve2Res = await apiJson(
      'POST',
      `/admin/group-health/assignments/${assignment2.id}/approve`,
      { token: admin2Token, body: { note: 'Hoàn tất duyệt chuyên khoa Tim mạch' } },
    );
    assert.equal(approve2Res.status, 200);
    assert.equal(approve2Res.body.data.idempotent, false);

    const { assignment: approvedAssign2, request: completedRequest } =
      approve2Res.body.data;

    assert.equal(approvedAssign2.resultStatus, GROUP_HEALTH_RESULT_STATUSES.APPROVED);
    assert.equal(approvedAssign2.reviewedBy, admin2.id);
    assert.equal(approvedAssign2.reviewedByName, 'Admin Duyệt 2');
    assert.ok(approvedAssign2.reviewedAt);
    assert.equal(
      approvedAssign2.reviewNote,
      'Hoàn tất duyệt chuyên khoa Tim mạch',
    );

    // Parent GroupHealthRequest is now COMPLETED with actor & timestamp!
    assert.equal(completedRequest.status, GROUP_HEALTH_REQUEST_STATUSES.COMPLETED);
    assert.equal(completedRequest.completedBy, admin2.id);
    assert.equal(completedRequest.completedByName, 'Admin Duyệt 2');
    assert.ok(completedRequest.completedAt);
    assert.equal(completedRequest.progress.isAllApproved, true);
    assert.equal(completedRequest.progress.approvedAssignments, 2);

    // Repeated approve after parent request is COMPLETED still succeeds idempotently!
    const repeatAfterCompleted = await apiJson(
      'PUT',
      `/admin/group-health/assignments/${assignment2.id}/approve`,
      { token: admin1Token, body: {} },
    );
    assert.equal(repeatAfterCompleted.status, 200);
    assert.equal(repeatAfterCompleted.body.data.idempotent, true);
    assert.equal(repeatAfterCompleted.body.data.assignment.reviewedBy, admin2.id);

    // Cannot reject once request is COMPLETED
    const rejectCompleted = await apiJson(
      'POST',
      `/admin/group-health/assignments/${assignment2.id}/reject`,
      { token: admin1Token, body: { note: 'Thử từ chối sau khi hoàn tất' } },
    );
    assert.equal(rejectCompleted.status, 409);

    // Verify AuditLog trail for reject, approve, and request completion
    const logs = await AuditLog.find({
      action: {
        $in: [
          AUDIT_ACTIONS.GROUP_HEALTH_RESULT_REJECT,
          AUDIT_ACTIONS.GROUP_HEALTH_RESULT_APPROVE,
          AUDIT_ACTIONS.GROUP_HEALTH_REQUEST_COMPLETE,
        ],
      },
    })
      .sort({ id: 1 })
      .lean();

    assert.equal(logs.length, 4); // 1 reject + 2 approves + 1 request completion
    assert.equal(logs[0].action, AUDIT_ACTIONS.GROUP_HEALTH_RESULT_REJECT);
    assert.equal(logs[0].actorId, admin1.id);
    assert.equal(logs[1].action, AUDIT_ACTIONS.GROUP_HEALTH_RESULT_APPROVE);
    assert.equal(logs[1].actorId, admin1.id);
    assert.equal(logs[2].action, AUDIT_ACTIONS.GROUP_HEALTH_REQUEST_COMPLETE);
    assert.equal(logs[2].actorId, admin2.id);
    assert.equal(logs[2].targetId, mainRequest.id);
    assert.equal(logs[3].action, AUDIT_ACTIONS.GROUP_HEALTH_RESULT_APPROVE);
    assert.equal(logs[3].actorId, admin2.id);
  });
});

