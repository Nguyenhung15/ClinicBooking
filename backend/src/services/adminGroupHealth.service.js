const {
  User,
  Specialty,
  DoctorShift,
  GroupHealthRequest,
  GroupHealthAssignment,
} = require('../models');
const {
  AUDIT_ACTIONS,
  GROUP_HEALTH_REQUEST_STATUSES,
  GROUP_HEALTH_RESULT_STATUSES,
  GROUP_HEALTH_FILE_REVIEW_STATUSES,
} = require('../constants/enums');
const { recordAudit } = require('./audit.service');
const {
  verifyResultFileInStorage,
  verifySourceFileInStorage,
} = require('../utils/groupHealthStorage');
const ApiError = require('../utils/ApiError');

const MAX_REVIEW_NOTE_LENGTH = 500;
const VALID_REQUEST_STATUSES = new Set(Object.values(GROUP_HEALTH_REQUEST_STATUSES));
const VALID_RESULT_STATUSES = new Set(Object.values(GROUP_HEALTH_RESULT_STATUSES));

function parsePositiveInt(value, fieldLabel = 'ID') {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ApiError(400, `${fieldLabel} không hợp lệ`);
  }
  return parsed;
}

function normalizeReviewNote(payload = {}) {
  const rawNote = payload.note !== undefined ? payload.note : payload.reviewNote;
  if (rawNote === undefined || rawNote === null) {
    return '';
  }
  if (typeof rawNote !== 'string') {
    throw new ApiError(400, 'Ghi chú duyệt (note) phải là chuỗi ký tự');
  }
  const trimmed = rawNote.trim();
  if (trimmed.length > MAX_REVIEW_NOTE_LENGTH) {
    throw new ApiError(
      400,
      `Ghi chú duyệt không được vượt quá ${MAX_REVIEW_NOTE_LENGTH} ký tự`,
    );
  }
  return trimmed;
}

function resolveTargetVersion(assignment, rawVersion) {
  const latestVersion = Number(assignment.resultVersion || 0);
  if (latestVersion < 1) {
    throw new ApiError(409, 'Phân công chưa có file kết quả nào được tải lên');
  }

  if (rawVersion === undefined || rawVersion === null || rawVersion === '') {
    return latestVersion;
  }

  const requestedVersion = parsePositiveInt(rawVersion, 'Phiên bản file (version)');
  if (requestedVersion !== latestVersion) {
    throw new ApiError(
      409,
      `Phiên bản cần duyệt (v${requestedVersion}) không khớp với phiên bản mới nhất hiện tại (v${latestVersion})`,
    );
  }

  return latestVersion;
}

function findResultFileByVersion(assignment, version) {
  const files = Array.isArray(assignment.resultFiles) ? assignment.resultFiles : [];
  return files.find((item) => Number(item.version) === Number(version)) || null;
}

function computeAssignmentsSummary(assignments = []) {
  const summary = {
    totalAssignments: assignments.length,
    approvedAssignments: 0,
    uploadedAssignments: 0,
    rejectedAssignments: 0,
    pendingUploadAssignments: 0,
    isAllApproved: false,
  };

  for (const item of assignments) {
    switch (item.resultStatus) {
      case GROUP_HEALTH_RESULT_STATUSES.APPROVED:
        summary.approvedAssignments += 1;
        break;
      case GROUP_HEALTH_RESULT_STATUSES.UPLOADED:
        summary.uploadedAssignments += 1;
        break;
      case GROUP_HEALTH_RESULT_STATUSES.REJECTED:
        summary.rejectedAssignments += 1;
        break;
      default:
        summary.pendingUploadAssignments += 1;
        break;
    }
  }

  summary.isAllApproved =
    summary.totalAssignments > 0 &&
    summary.approvedAssignments === summary.totalAssignments;

  return summary;
}

async function buildEnrichmentContext({ requests = [], assignments = [] } = {}) {
  const userIds = new Set();
  const shiftIds = new Set();
  const specialtyIds = new Set();

  for (const reqDoc of requests) {
    if (reqDoc?.createdBy) userIds.add(reqDoc.createdBy);
    if (reqDoc?.approvedBy) userIds.add(reqDoc.approvedBy);
    if (reqDoc?.completedBy) userIds.add(reqDoc.completedBy);
  }

  for (const assignDoc of assignments) {
    if (!assignDoc) continue;
    if (assignDoc.doctorId) userIds.add(assignDoc.doctorId);
    if (assignDoc.reviewedBy) userIds.add(assignDoc.reviewedBy);
    if (assignDoc.shiftId) shiftIds.add(assignDoc.shiftId);
    if (assignDoc.specialtyId) specialtyIds.add(assignDoc.specialtyId);
    for (const file of assignDoc.resultFiles || []) {
      if (file.uploadedBy) userIds.add(file.uploadedBy);
      if (file.reviewedBy) userIds.add(file.reviewedBy);
    }
  }

  const [users, shifts, specialties] = await Promise.all([
    userIds.size > 0
      ? User.find({ id: { $in: [...userIds] } })
          .select('id fullName email userType')
          .lean()
      : [],
    shiftIds.size > 0
      ? DoctorShift.find({ id: { $in: [...shiftIds] } })
          .select('id date shift startTime endTime status')
          .lean()
      : [],
    specialtyIds.size > 0
      ? Specialty.find({ id: { $in: [...specialtyIds] } })
          .select('id name')
          .lean()
      : [],
  ]);

  return {
    usersById: new Map(users.map((u) => [u.id, u])),
    shiftsById: new Map(shifts.map((s) => [s.id, s])),
    specialtiesById: new Map(specialties.map((sp) => [sp.id, sp])),
    requestsById: new Map(requests.filter(Boolean).map((r) => [r.id, r])),
  };
}

function toIsoOrNull(dateValue) {
  if (!dateValue) return null;
  const dateObj = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return Number.isNaN(dateObj.getTime()) ? null : dateObj.toISOString();
}

function serializeResultFile(file, usersById) {
  const uploader = file.uploadedBy ? usersById.get(file.uploadedBy) : null;
  const reviewer = file.reviewedBy ? usersById.get(file.reviewedBy) : null;

  return {
    version: file.version,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    uploadedBy: file.uploadedBy ?? null,
    uploadedByName: uploader?.fullName || null,
    uploadedAt: toIsoOrNull(file.uploadedAt),
    reviewStatus: file.reviewStatus,
    reviewedBy: file.reviewedBy ?? null,
    reviewedByName: reviewer?.fullName || null,
    reviewedAt: toIsoOrNull(file.reviewedAt),
    reviewNote: file.reviewNote || '',
  };
}

function serializeAssignment(assignment, context) {
  const { usersById, shiftsById, specialtiesById, requestsById } = context;
  const request = requestsById.get(assignment.requestId) || null;
  const doctor = usersById.get(assignment.doctorId) || null;
  const shift = assignment.shiftId ? shiftsById.get(assignment.shiftId) : null;
  const specialty = assignment.specialtyId
    ? specialtiesById.get(assignment.specialtyId)
    : null;

  const latestFile = findResultFileByVersion(assignment, assignment.resultVersion);
  const effectiveReviewedBy =
    assignment.reviewedBy ?? latestFile?.reviewedBy ?? null;
  const effectiveReviewedAt =
    assignment.reviewedAt ?? latestFile?.reviewedAt ?? null;
  const effectiveReviewNote =
    assignment.reviewNote || latestFile?.reviewNote || '';
  const reviewer = effectiveReviewedBy ? usersById.get(effectiveReviewedBy) : null;

  return {
    id: assignment.id,
    requestId: assignment.requestId,
    groupName: request?.groupName || '',
    departments: request?.departments || '',
    preferredDate: request?.preferredDate || null,
    requestStatus: request?.status || null,
    doctorId: assignment.doctorId,
    doctorName: doctor?.fullName || '',
    doctorEmail: doctor?.email || '',
    specialtyId: assignment.specialtyId ?? null,
    specialtyName: specialty?.name || '',
    shiftId: assignment.shiftId ?? null,
    shiftDate: shift?.date || null,
    shift: shift?.shift || null,
    capacityAllocated: assignment.capacityAllocated ?? null,
    note: assignment.note || '',
    sourceFileAvailable: Boolean(request?.sourceFileId),
    sourceFileName: request?.sourceFileName || '',
    resultStatus: assignment.resultStatus,
    resultVersion: Number(assignment.resultVersion || 0),
    reviewedBy: effectiveReviewedBy,
    reviewedByName: reviewer?.fullName || null,
    reviewedAt: toIsoOrNull(effectiveReviewedAt),
    reviewNote: effectiveReviewNote,
    resultFiles: (assignment.resultFiles || []).map((file) =>
      serializeResultFile(file, usersById),
    ),
    createdAt: toIsoOrNull(assignment.createdAt),
    updatedAt: toIsoOrNull(assignment.updatedAt),
  };
}

function serializeRequest(request, assignmentsForRequest, context, { includeAssignments = false } = {}) {
  const { usersById } = context;
  const creator = request.createdBy ? usersById.get(request.createdBy) : null;
  const approver = request.approvedBy ? usersById.get(request.approvedBy) : null;
  const completer = request.completedBy ? usersById.get(request.completedBy) : null;

  const payload = {
    id: request.id,
    groupName: request.groupName,
    departments: request.departments || '',
    phoneNumber: request.phoneNumber || '',
    preferredDate: request.preferredDate || null,
    status: request.status,
    createdBy: request.createdBy ?? null,
    createdByName: creator?.fullName || null,
    approvedBy: request.approvedBy ?? null,
    approvedByName: approver?.fullName || null,
    approvedAt: toIsoOrNull(request.approvedAt),
    completedBy: request.completedBy ?? null,
    completedByName: completer?.fullName || null,
    completedAt: toIsoOrNull(request.completedAt),
    sourceFileAvailable: Boolean(request.sourceFileId),
    sourceFileName: request.sourceFileName || '',
    sourceFileSize: request.sourceFileSize ?? null,
    sourceFileMimeType: request.sourceFileMimeType || '',
    progress: computeAssignmentsSummary(assignmentsForRequest),
    createdAt: toIsoOrNull(request.createdAt),
    updatedAt: toIsoOrNull(request.updatedAt),
  };

  if (includeAssignments) {
    payload.assignments = assignmentsForRequest.map((item) =>
      serializeAssignment(item, context),
    );
  }

  return payload;
}

/**
 * Evaluate whether every assignment of a GroupHealthRequest has a physically valid,
 * admin-approved result file. Only transitions APPROVED -> COMPLETED when ALL
 * assignments are complete and verified in GridFS.
 */
async function syncRequestCompletionStatus(requestId, actor, req = null) {
  const request = await GroupHealthRequest.findOne({ id: requestId }).lean();
  if (!request) {
    throw new ApiError(404, 'Không tìm thấy yêu cầu khám nhóm');
  }

  const assignments = await GroupHealthAssignment.find({ requestId })
    .sort({ id: 1 })
    .lean();

  if (assignments.length === 0) {
    return { request, assignments, completedTransition: false };
  }

  const allMarkedApproved = assignments.every(
    (item) =>
      item.resultStatus === GROUP_HEALTH_RESULT_STATUSES.APPROVED &&
      Number(item.resultVersion) >= 1,
  );

  if (!allMarkedApproved) {
    return { request, assignments, completedTransition: false };
  }

  // Verify physical result file integrity in GridFS for every assignment before completing
  const storageChecks = await Promise.all(
    assignments.map(async (item) => {
      const targetFile = findResultFileByVersion(item, item.resultVersion);
      if (
        !targetFile ||
        targetFile.reviewStatus !== GROUP_HEALTH_FILE_REVIEW_STATUSES.APPROVED
      ) {
        return false;
      }
      const { exists } = await verifyResultFileInStorage(targetFile.fileId, item.id);
      return exists;
    }),
  );

  const allFilesVerified = storageChecks.every(Boolean);
  if (!allFilesVerified) {
    return { request, assignments, completedTransition: false };
  }

  if (request.status === GROUP_HEALTH_REQUEST_STATUSES.COMPLETED) {
    return { request, assignments, completedTransition: false };
  }

  if (request.status !== GROUP_HEALTH_REQUEST_STATUSES.APPROVED) {
    return { request, assignments, completedTransition: false };
  }

  const completedAt = new Date();
  const updatedRequest = await GroupHealthRequest.findOneAndUpdate(
    { id: requestId, status: GROUP_HEALTH_REQUEST_STATUSES.APPROVED },
    {
      $set: {
        status: GROUP_HEALTH_REQUEST_STATUSES.COMPLETED,
        completedBy: actor.id,
        completedAt,
      },
    },
    { returnDocument: 'after', runValidators: true },
  ).lean();

  if (!updatedRequest) {
    const reloadedRequest = await GroupHealthRequest.findOne({ id: requestId }).lean();
    return {
      request: reloadedRequest || request,
      assignments,
      completedTransition: false,
    };
  }

  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.GROUP_HEALTH_REQUEST_COMPLETE,
    targetType: 'GroupHealthRequest',
    targetId: updatedRequest.id,
    reason: 'Tất cả phân công kết quả khám nhóm đã được duyệt hoàn tất',
    changes: {
      before: { status: GROUP_HEALTH_REQUEST_STATUSES.APPROVED },
      after: {
        status: GROUP_HEALTH_REQUEST_STATUSES.COMPLETED,
        completedBy: actor.id,
        completedAt: completedAt.toISOString(),
        totalAssignments: assignments.length,
      },
    },
    req,
  });

  return {
    request: updatedRequest,
    assignments,
    completedTransition: true,
  };
}

async function listRequests({ status } = {}) {
  const filter = {};
  if (status !== undefined && status !== '') {
    const normalizedStatus = String(status).trim().toUpperCase();
    if (!VALID_REQUEST_STATUSES.has(normalizedStatus)) {
      throw new ApiError(400, `Trạng thái yêu cầu không hợp lệ: ${status}`);
    }
    filter.status = normalizedStatus;
  }

  const requests = await GroupHealthRequest.find(filter)
    .sort({ createdAt: -1, id: -1 })
    .lean();

  if (requests.length === 0) return [];

  const requestIds = requests.map((r) => r.id);
  const assignments = await GroupHealthAssignment.find({
    requestId: { $in: requestIds },
  })
    .sort({ id: 1 })
    .lean();

  const assignmentsByRequestId = new Map();
  for (const item of assignments) {
    if (!assignmentsByRequestId.has(item.requestId)) {
      assignmentsByRequestId.set(item.requestId, []);
    }
    assignmentsByRequestId.get(item.requestId).push(item);
  }

  const context = await buildEnrichmentContext({ requests, assignments });
  return requests.map((reqDoc) =>
    serializeRequest(
      reqDoc,
      assignmentsByRequestId.get(reqDoc.id) || [],
      context,
      { includeAssignments: false },
    ),
  );
}

async function getRequestDetail(requestId) {
  const numericRequestId = parsePositiveInt(requestId, 'Request ID');
  const request = await GroupHealthRequest.findOne({ id: numericRequestId }).lean();
  if (!request) {
    throw new ApiError(404, 'Không tìm thấy yêu cầu khám nhóm');
  }

  const assignments = await GroupHealthAssignment.find({
    requestId: numericRequestId,
  })
    .sort({ id: 1 })
    .lean();

  const context = await buildEnrichmentContext({
    requests: [request],
    assignments,
  });

  return serializeRequest(request, assignments, context, {
    includeAssignments: true,
  });
}

async function listAssignments({ resultStatus, requestId, doctorId } = {}) {
  const filter = {};
  if (resultStatus !== undefined && resultStatus !== '') {
    const normalizedResultStatus = String(resultStatus).trim().toUpperCase();
    if (!VALID_RESULT_STATUSES.has(normalizedResultStatus)) {
      throw new ApiError(
        400,
        `Trạng thái kết quả phân công không hợp lệ: ${resultStatus}`,
      );
    }
    filter.resultStatus = normalizedResultStatus;
  }
  if (requestId !== undefined && requestId !== '') {
    filter.requestId = parsePositiveInt(requestId, 'Request ID');
  }
  if (doctorId !== undefined && doctorId !== '') {
    filter.doctorId = parsePositiveInt(doctorId, 'Doctor ID');
  }

  const assignments = await GroupHealthAssignment.find(filter)
    .sort({ updatedAt: -1, id: -1 })
    .lean();

  if (assignments.length === 0) return [];

  const requestIds = [...new Set(assignments.map((a) => a.requestId))];
  const requests = await GroupHealthRequest.find({
    id: { $in: requestIds },
  }).lean();

  const context = await buildEnrichmentContext({ requests, assignments });
  return assignments.map((item) => serializeAssignment(item, context));
}

async function getAssignmentDetail(assignmentId) {
  const numericAssignmentId = parsePositiveInt(assignmentId, 'Assignment ID');
  const assignment = await GroupHealthAssignment.findOne({
    id: numericAssignmentId,
  }).lean();
  if (!assignment) {
    throw new ApiError(404, 'Không tìm thấy phân công khám nhóm');
  }

  const request = await GroupHealthRequest.findOne({
    id: assignment.requestId,
  }).lean();
  if (!request) {
    throw new ApiError(404, 'Không tìm thấy yêu cầu khám nhóm của phân công này');
  }

  const siblingAssignments = await GroupHealthAssignment.find({
    requestId: request.id,
  })
    .sort({ id: 1 })
    .lean();

  const context = await buildEnrichmentContext({
    requests: [request],
    assignments: siblingAssignments,
  });

  return {
    assignment: serializeAssignment(assignment, context),
    request: serializeRequest(request, siblingAssignments, context, {
      includeAssignments: false,
    }),
  };
}

async function getRequestSourceFileForAdmin(requestId) {
  const numericRequestId = parsePositiveInt(requestId, 'Request ID');
  const request = await GroupHealthRequest.findOne({ id: numericRequestId }).lean();
  if (!request) {
    throw new ApiError(404, 'Không tìm thấy yêu cầu khám nhóm');
  }
  if (!request.sourceFileId) {
    throw new ApiError(404, 'Yêu cầu khám nhóm không có file danh sách gốc');
  }

  const { exists, gridFsFile } = await verifySourceFileInStorage(
    request.sourceFileId,
    request.id,
  );
  if (!exists || !gridFsFile) {
    throw new ApiError(404, 'File danh sách gốc không tồn tại trên hệ thống lưu trữ');
  }

  return {
    fileId: request.sourceFileId,
    originalName: request.sourceFileName || gridFsFile.filename || 'group-health-source.xlsx',
    mimeType:
      request.sourceFileMimeType ||
      gridFsFile.metadata?.contentType ||
      'application/octet-stream',
    size: request.sourceFileSize || gridFsFile.length,
  };
}

async function getAssignmentFileForAdmin(assignmentId, { kind = 'result', version = 'latest' } = {}) {
  const numericAssignmentId = parsePositiveInt(assignmentId, 'Assignment ID');
  const assignment = await GroupHealthAssignment.findOne({
    id: numericAssignmentId,
  }).lean();
  if (!assignment) {
    throw new ApiError(404, 'Không tìm thấy phân công khám nhóm');
  }

  if (kind === 'source') {
    return getRequestSourceFileForAdmin(assignment.requestId);
  }

  const targetVersion =
    version === undefined || version === null || version === '' || version === 'latest'
      ? Number(assignment.resultVersion || 0)
      : parsePositiveInt(version, 'Phiên bản file (version)');

  if (targetVersion < 1) {
    throw new ApiError(404, 'Phân công chưa có file kết quả được tải lên');
  }

  const targetFile = findResultFileByVersion(assignment, targetVersion);
  if (!targetFile) {
    throw new ApiError(
      404,
      `Không tìm thấy file kết quả phiên bản v${targetVersion}`,
    );
  }

  const { exists, gridFsFile } = await verifyResultFileInStorage(
    targetFile.fileId,
    assignment.id,
  );
  if (!exists || !gridFsFile) {
    throw new ApiError(
      404,
      'File kết quả không tồn tại trên hệ thống lưu trữ',
    );
  }

  return {
    fileId: targetFile.fileId,
    version: targetFile.version,
    originalName: targetFile.originalName || gridFsFile.filename,
    mimeType:
      targetFile.mimeType ||
      gridFsFile.metadata?.contentType ||
      'application/octet-stream',
    size: targetFile.size || gridFsFile.length,
  };
}

async function buildReviewResponse(assignmentId, requestId) {
  const [assignment, request, allAssignments] = await Promise.all([
    GroupHealthAssignment.findOne({ id: assignmentId }).lean(),
    GroupHealthRequest.findOne({ id: requestId }).lean(),
    GroupHealthAssignment.find({ requestId }).sort({ id: 1 }).lean(),
  ]);

  const context = await buildEnrichmentContext({
    requests: [request],
    assignments: allAssignments,
  });

  return {
    assignment: serializeAssignment(assignment, context),
    request: serializeRequest(request, allAssignments, context, {
      includeAssignments: false,
    }),
  };
}

/**
 * UC-ADM-07 — Approve an assignment's uploaded result file.
 * - Precondition: assignment.resultStatus === 'UPLOADED' (or 'APPROVED' for idempotent re-approve).
 * - Verifies physical file existence in GridFS; rejects if file is missing.
 * - Idempotent on repeated approve: preserves original actor (`reviewedBy`) & timestamp (`reviewedAt`).
 * - Transitions parent GroupHealthRequest to 'COMPLETED' iff all assignments are 'APPROVED' with valid files.
 */
async function approveAssignmentResult(actor, assignmentId, payload = {}, req = null) {
  const numericAssignmentId = parsePositiveInt(assignmentId, 'Assignment ID');
  const reviewNote = normalizeReviewNote(payload);

  const assignment = await GroupHealthAssignment.findOne({
    id: numericAssignmentId,
  }).lean();
  if (!assignment) {
    throw new ApiError(404, 'Không tìm thấy phân công khám nhóm');
  }

  const request = await GroupHealthRequest.findOne({
    id: assignment.requestId,
  }).lean();
  if (!request) {
    throw new ApiError(404, 'Không tìm thấy yêu cầu khám nhóm của phân công này');
  }

  if (
    ![
      GROUP_HEALTH_REQUEST_STATUSES.APPROVED,
      GROUP_HEALTH_REQUEST_STATUSES.COMPLETED,
    ].includes(request.status)
  ) {
    throw new ApiError(
      409,
      `Không thể duyệt kết quả khi yêu cầu khám nhóm đang ở trạng thái ${request.status}`,
    );
  }

  // Idempotent path: assignment is already APPROVED for the current version
  if (assignment.resultStatus === GROUP_HEALTH_RESULT_STATUSES.APPROVED) {
    const targetVersion = resolveTargetVersion(assignment, payload.version);
    const approvedFile = findResultFileByVersion(assignment, targetVersion);
    if (!approvedFile) {
      throw new ApiError(
        409,
        'Không tìm thấy thông tin file kết quả đã duyệt của phân công này',
      );
    }

    const { exists } = await verifyResultFileInStorage(
      approvedFile.fileId,
      assignment.id,
    );
    if (!exists) {
      throw new ApiError(
        409,
        'File kết quả bị thiếu trên hệ thống lưu trữ, không thể xác nhận hoàn tất',
      );
    }

    await syncRequestCompletionStatus(request.id, actor, req);
    const snapshot = await buildReviewResponse(assignment.id, request.id);
    return {
      idempotent: true,
      ...snapshot,
    };
  }

  if (request.status !== GROUP_HEALTH_REQUEST_STATUSES.APPROVED) {
    throw new ApiError(
      409,
      `Chỉ có thể duyệt kết quả mới khi yêu cầu khám nhóm ở trạng thái APPROVED (hiện tại: ${request.status})`,
    );
  }

  if (assignment.resultStatus === GROUP_HEALTH_RESULT_STATUSES.NONE) {
    throw new ApiError(
      409,
      'Bác sĩ chưa tải lên file kết quả cho phân công này (ResultStatus = NONE)',
    );
  }

  if (assignment.resultStatus !== GROUP_HEALTH_RESULT_STATUSES.UPLOADED) {
    throw new ApiError(
      409,
      `Chỉ có thể duyệt phân công có trạng thái UPLOADED (hiện tại: ${assignment.resultStatus})`,
    );
  }

  const targetVersion = resolveTargetVersion(assignment, payload.version);
  const targetFile = findResultFileByVersion(assignment, targetVersion);
  if (!targetFile) {
    throw new ApiError(
      409,
      `Thiếu thông tin file kết quả phiên bản v${targetVersion}, không thể duyệt`,
    );
  }

  const { exists } = await verifyResultFileInStorage(
    targetFile.fileId,
    assignment.id,
  );
  if (!exists) {
    throw new ApiError(
      409,
      'File kết quả không tồn tại trên hệ thống lưu trữ, không thể duyệt',
    );
  }

  const reviewedAt = new Date();
  const updatedAssignment = await GroupHealthAssignment.findOneAndUpdate(
    {
      id: assignment.id,
      resultStatus: GROUP_HEALTH_RESULT_STATUSES.UPLOADED,
      resultVersion: targetVersion,
      'resultFiles.version': targetVersion,
    },
    {
      $set: {
        resultStatus: GROUP_HEALTH_RESULT_STATUSES.APPROVED,
        reviewedBy: actor.id,
        reviewedAt,
        reviewNote,
        'resultFiles.$.reviewStatus': GROUP_HEALTH_FILE_REVIEW_STATUSES.APPROVED,
        'resultFiles.$.reviewedBy': actor.id,
        'resultFiles.$.reviewedAt': reviewedAt,
        'resultFiles.$.reviewNote': reviewNote,
      },
    },
    { returnDocument: 'after', runValidators: true },
  ).lean();

  if (!updatedAssignment) {
    // Handle concurrent identical approve request idempotently
    const latestAssignment = await GroupHealthAssignment.findOne({
      id: assignment.id,
    }).lean();
    if (
      latestAssignment &&
      latestAssignment.resultStatus === GROUP_HEALTH_RESULT_STATUSES.APPROVED &&
      Number(latestAssignment.resultVersion) === targetVersion
    ) {
      await syncRequestCompletionStatus(request.id, actor, req);
      const snapshot = await buildReviewResponse(assignment.id, request.id);
      return {
        idempotent: true,
        ...snapshot,
      };
    }

    throw new ApiError(
      409,
      'Trạng thái hoặc phiên bản kết quả đã thay đổi trong lúc xử lý, vui lòng tải lại và thử lại',
    );
  }

  const syncOutcome = await syncRequestCompletionStatus(request.id, actor, req);

  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.GROUP_HEALTH_RESULT_APPROVE,
    targetType: 'GroupHealthAssignment',
    targetId: assignment.id,
    reason: reviewNote || `Duyệt kết quả khám nhóm phiên bản v${targetVersion}`,
    changes: {
      before: {
        resultStatus: assignment.resultStatus,
        resultVersion: targetVersion,
        reviewStatus: targetFile.reviewStatus,
      },
      after: {
        resultStatus: GROUP_HEALTH_RESULT_STATUSES.APPROVED,
        resultVersion: targetVersion,
        reviewStatus: GROUP_HEALTH_FILE_REVIEW_STATUSES.APPROVED,
        reviewedBy: actor.id,
        reviewedAt: reviewedAt.toISOString(),
        reviewNote,
        requestStatus: syncOutcome.request.status,
      },
    },
    req,
  });

  const snapshot = await buildReviewResponse(assignment.id, request.id);
  return {
    idempotent: false,
    ...snapshot,
  };
}

/**
 * UC-ADM-07 — Reject an assignment's uploaded result file with note.
 * - Precondition: assignment.resultStatus === 'UPLOADED' and parent request.status === 'APPROVED'.
 * - Records actor (`reviewedBy`), timestamp (`reviewedAt`), and `reviewNote`.
 * - Parent GroupHealthRequest remains 'APPROVED' so assigned doctor can upload a corrected version.
 */
async function rejectAssignmentResult(actor, assignmentId, payload = {}, req = null) {
  const numericAssignmentId = parsePositiveInt(assignmentId, 'Assignment ID');
  const reviewNote = normalizeReviewNote(payload);

  const assignment = await GroupHealthAssignment.findOne({
    id: numericAssignmentId,
  }).lean();
  if (!assignment) {
    throw new ApiError(404, 'Không tìm thấy phân công khám nhóm');
  }

  const request = await GroupHealthRequest.findOne({
    id: assignment.requestId,
  }).lean();
  if (!request) {
    throw new ApiError(404, 'Không tìm thấy yêu cầu khám nhóm của phân công này');
  }

  if (request.status !== GROUP_HEALTH_REQUEST_STATUSES.APPROVED) {
    throw new ApiError(
      409,
      `Chỉ có thể từ chối kết quả khi yêu cầu khám nhóm ở trạng thái APPROVED (hiện tại: ${request.status})`,
    );
  }

  if (assignment.resultStatus !== GROUP_HEALTH_RESULT_STATUSES.UPLOADED) {
    throw new ApiError(
      409,
      `Chỉ có thể từ chối phân công đang ở trạng thái UPLOADED (hiện tại: ${assignment.resultStatus})`,
    );
  }

  const targetVersion = resolveTargetVersion(assignment, payload.version);
  const targetFile = findResultFileByVersion(assignment, targetVersion);
  if (!targetFile) {
    throw new ApiError(
      409,
      `Không tìm thấy file kết quả phiên bản v${targetVersion} để từ chối`,
    );
  }

  const reviewedAt = new Date();
  const updatedAssignment = await GroupHealthAssignment.findOneAndUpdate(
    {
      id: assignment.id,
      resultStatus: GROUP_HEALTH_RESULT_STATUSES.UPLOADED,
      resultVersion: targetVersion,
      'resultFiles.version': targetVersion,
    },
    {
      $set: {
        resultStatus: GROUP_HEALTH_RESULT_STATUSES.REJECTED,
        reviewedBy: actor.id,
        reviewedAt,
        reviewNote,
        'resultFiles.$.reviewStatus': GROUP_HEALTH_FILE_REVIEW_STATUSES.REJECTED,
        'resultFiles.$.reviewedBy': actor.id,
        'resultFiles.$.reviewedAt': reviewedAt,
        'resultFiles.$.reviewNote': reviewNote,
      },
    },
    { returnDocument: 'after', runValidators: true },
  ).lean();

  if (!updatedAssignment) {
    throw new ApiError(
      409,
      'Trạng thái hoặc phiên bản kết quả đã thay đổi trong lúc xử lý, vui lòng tải lại và thử lại',
    );
  }

  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.GROUP_HEALTH_RESULT_REJECT,
    targetType: 'GroupHealthAssignment',
    targetId: assignment.id,
    reason: reviewNote || `Từ chối kết quả khám nhóm phiên bản v${targetVersion}`,
    changes: {
      before: {
        resultStatus: assignment.resultStatus,
        resultVersion: targetVersion,
        reviewStatus: targetFile.reviewStatus,
      },
      after: {
        resultStatus: GROUP_HEALTH_RESULT_STATUSES.REJECTED,
        resultVersion: targetVersion,
        reviewStatus: GROUP_HEALTH_FILE_REVIEW_STATUSES.REJECTED,
        reviewedBy: actor.id,
        reviewedAt: reviewedAt.toISOString(),
        reviewNote,
        requestStatus: request.status,
      },
    },
    req,
  });

  return buildReviewResponse(assignment.id, request.id);
}

async function reviewAssignmentResult(actor, assignmentId, payload = {}, req = null) {
  const decision = String(payload.decision || payload.action || '')
    .trim()
    .toUpperCase();

  if (decision === 'APPROVE' || decision === 'APPROVED') {
    return approveAssignmentResult(actor, assignmentId, payload, req);
  }
  if (decision === 'REJECT' || decision === 'REJECTED') {
    return rejectAssignmentResult(actor, assignmentId, payload, req);
  }

  throw new ApiError(
    400,
    'Quyết định duyệt (decision) phải là APPROVE hoặc REJECT',
  );
}

module.exports = {
  listRequests,
  getRequestDetail,
  listAssignments,
  getAssignmentDetail,
  getRequestSourceFileForAdmin,
  getAssignmentFileForAdmin,
  approveAssignmentResult,
  rejectAssignmentResult,
  reviewAssignmentResult,
  syncRequestCompletionStatus,
};

