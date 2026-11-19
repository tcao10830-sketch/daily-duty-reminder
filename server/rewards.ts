import { randomUUID } from 'node:crypto';
import { db, withDb } from './db.ts';
import { HttpError } from './errors.ts';
import { deadlineMs } from './time.ts';

type EarlyRule = { hours: number; pencils: number };
type LedgerSource = 'early' | 'quality' | 'streak' | 'adjustment' | 'streak_reversal';

function nowIso() { return new Date().toISOString(); }
function ensureStreak(studentId: string) {
  db.prepare("INSERT OR IGNORE INTO student_streaks (student_id, current_streak, status, updated_at) VALUES (?, 0, 'active', ?)").run(studentId, nowIso());
}
function addLedger(studentId: string, teacherId: string | null, assignmentId: string | null, source: LedgerSource, amount: number, note: string) {
  if (!amount) return;
  const createdAt = nowIso();
  if (assignmentId && source !== 'adjustment') {
    const claim = db.prepare('INSERT OR IGNORE INTO pencil_reward_claims (student_id, assignment_id, source, created_at) VALUES (?, ?, ?, ?)')
      .run(studentId, assignmentId, source, createdAt);
    if (Number(claim.changes) === 0) return;
  }
  const inserted = db.prepare("INSERT OR IGNORE INTO pencil_ledger (id, student_id, teacher_id, assignment_id, source, amount, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), studentId, teacherId, assignmentId, source, amount, note.slice(0, 500), createdAt);
  if (Number(inserted.changes) > 0) {
    db.prepare(`INSERT INTO student_pencil_balances (student_id, total_pencils, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(student_id) DO UPDATE SET total_pencils = total_pencils + excluded.total_pencils, updated_at = excluded.updated_at`)
      .run(studentId, amount, createdAt);
  }
}
function notify(userId: string, type: string, title: string, body: string, entityId: string) {
  db.prepare("INSERT OR IGNORE INTO notifications (id, user_id, type, title, body, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), userId, type, title, body, entityId, nowIso());
}
function streakBonus(n: number) {
  if (n >= 51) return 5;
  if (n >= 46) return 4;
  if (n >= 36) return 3;
  if (n >= 21) return 2;
  if (n >= 6) return 1;
  return 0;
}
function getRules(teacherId: string): EarlyRule[] {
  const row = db.prepare('SELECT early_rules_json FROM reward_settings WHERE teacher_id = ?').get(teacherId) as { early_rules_json: string } | undefined;
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.early_rules_json) as EarlyRule[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

/** Called inside the existing serialized store transaction after a submission is persisted. */
export function recordSubmissionRewardsLocked(studentId: string, assignmentId: string, submittedAt: string) {
  const assignment = db.prepare(`
    SELECT a.id, a.student_id, a.revision_deadline_at, t.teacher_id, t.title, t.deadline_date, t.deadline_time
    FROM task_assignments a JOIN tasks t ON t.id = a.task_id
    WHERE a.id = ? AND a.student_id = ? AND t.status = 'active'
  `).get(assignmentId, studentId) as { id: string; student_id: string; revision_deadline_at: string | null; teacher_id: string; title: string; deadline_date: string; deadline_time: string } | undefined;
  if (!assignment) return;
  const existing = db.prepare('SELECT assignment_id FROM streak_events WHERE assignment_id = ?').get(assignmentId);
  if (existing) return;

  ensureStreak(studentId);
  const state = db.prepare('SELECT * FROM student_streaks WHERE student_id = ?').get(studentId) as {
    current_streak: number; status: string; grace_deadline_at: string | null; threatened_assignment_id: string | null;
  };
  const submittedMs = new Date(submittedAt).getTime();
  const dueMs = assignment.revision_deadline_at
    ? new Date(assignment.revision_deadline_at).getTime()
    : deadlineMs(assignment.deadline_date, assignment.deadline_time);
  let current = state.current_streak;
  if (state.status === 'broken' || (state.grace_deadline_at && submittedMs > new Date(state.grace_deadline_at).getTime())) current = 0;
  if (submittedMs > dueMs + 24 * 60 * 60 * 1000) current = 0;
  const resolvesThreat = state.status !== 'threatened' || state.threatened_assignment_id === assignmentId;
  const next = current + 1;
  const bonus = streakBonus(next);
  db.prepare(`
    INSERT INTO streak_events (assignment_id, student_id, streak_number, submitted_at, streak_bonus, counted)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(assignmentId, studentId, next, submittedAt, bonus);
  db.prepare(`
    UPDATE student_streaks SET current_streak = ?, status = ?, grace_deadline_at = ?, threatened_assignment_id = ?,
      last_submitted_at = ?, updated_at = ? WHERE student_id = ?
  `).run(
    next,
    resolvesThreat ? 'active' : 'threatened',
    resolvesThreat ? null : state.grace_deadline_at,
    resolvesThreat ? null : state.threatened_assignment_id,
    submittedAt, nowIso(), studentId,
  );
  if (bonus) addLedger(studentId, assignment.teacher_id, assignmentId, 'streak', bonus, `Streak task #${next}`);

  const hoursEarly = (dueMs - submittedMs) / (60 * 60 * 1000);
  if (hoursEarly > 0) {
    const rule = getRules(assignment.teacher_id)
      .filter((item) => Number.isFinite(item.hours) && Number.isFinite(item.pencils) && item.hours > 0 && item.pencils > 0 && hoursEarly >= item.hours)
      .sort((a, b) => b.hours - a.hours)[0];
    if (rule) addLedger(studentId, assignment.teacher_id, assignmentId, 'early', Math.floor(rule.pencils), `Submitted ${Math.floor(hoursEarly)} hours early`);
  }
}

/** Called inside the same serialized transaction when a teacher requests a revision. */
export function flagStreakRevisionLocked(teacherId: string, assignmentId: string) {
  const row = db.prepare(`
    SELECT e.student_id, e.streak_number, t.title, u.name AS student_name
    FROM streak_events e
    JOIN task_assignments a ON a.id = e.assignment_id
    JOIN tasks t ON t.id = a.task_id
    JOIN users u ON u.id = e.student_id
    WHERE e.assignment_id = ? AND t.teacher_id = ?
  `).get(assignmentId, teacherId) as { student_id: string; streak_number: number; title: string; student_name: string } | undefined;
  if (!row) return;
  db.prepare('UPDATE streak_events SET review_required = 1, decision = NULL WHERE assignment_id = ?').run(assignmentId);
  notify(teacherId, 'streak_revision_review', 'Cần quyết định về chuỗi thành tích', `${row.student_name} · ${row.title} · nhiệm vụ thứ ${row.streak_number} trong chuỗi. Hãy quyết định có tiếp tục duy trì chuỗi hay không.`, assignmentId);
}

/** Called from the periodic deadline sweep, inside withDb. */
export function sweepStreaksLocked() {
  const now = Date.now();
  const streaks = db.prepare("SELECT * FROM student_streaks WHERE current_streak > 0 AND status <> 'broken'").all() as {
    student_id: string; current_streak: number; status: string; grace_deadline_at: string | null; threatened_assignment_id: string | null;
  }[];
  for (const streak of streaks) {
    const awaitingDecision = db.prepare('SELECT assignment_id FROM streak_events WHERE student_id = ? AND review_required = 1 AND decision IS NULL LIMIT 1').get(streak.student_id);
    if (awaitingDecision) continue;
    if (streak.status === 'threatened' && streak.grace_deadline_at && now > new Date(streak.grace_deadline_at).getTime()) {
      db.prepare("UPDATE student_streaks SET current_streak = 0, status = 'broken', grace_deadline_at = NULL, threatened_assignment_id = NULL, updated_at = ? WHERE student_id = ?")
        .run(nowIso(), streak.student_id);
      notify(streak.student_id, 'streak_lost', 'Chuỗi thành tích của bạn đã kết thúc', 'Thời gian gia hạn 24 giờ đã kết thúc. Nhiệm vụ tiếp theo bạn hoàn thành sẽ bắt đầu một chuỗi mới.', streak.threatened_assignment_id || 'streak');
      continue;
    }
    if (streak.status === 'threatened') continue;
    const pending = db.prepare(`
      SELECT a.id, t.title, t.teacher_id, t.deadline_date, t.deadline_time, a.revision_deadline_at
      FROM task_assignments a JOIN tasks t ON t.id = a.task_id
      LEFT JOIN task_completions c ON c.assignment_id = a.id
      WHERE a.student_id = ? AND t.status = 'active' AND a.submitted_at IS NULL AND c.id IS NULL
      ORDER BY t.deadline_date, t.deadline_time
    `).all(streak.student_id) as { id: string; title: string; teacher_id: string; deadline_date: string; deadline_time: string; revision_deadline_at: string | null }[];
    const overdue = pending.map((item) => ({ ...item, due: item.revision_deadline_at ? new Date(item.revision_deadline_at).getTime() : deadlineMs(item.deadline_date, item.deadline_time) }))
      .filter((item) => item.due < now)
      .sort((a, b) => a.due - b.due)[0];
    if (!overdue) continue;
    const grace = overdue.due + 24 * 60 * 60 * 1000;
    if (now > grace) {
      db.prepare("UPDATE student_streaks SET current_streak = 0, status = 'broken', grace_deadline_at = NULL, threatened_assignment_id = NULL, updated_at = ? WHERE student_id = ?")
        .run(nowIso(), streak.student_id);
      notify(streak.student_id, 'streak_lost', 'Chuỗi thành tích của bạn đã kết thúc', 'Một nhiệm vụ vẫn quá hạn sau thời gian gia hạn 24 giờ. Nhiệm vụ tiếp theo bạn hoàn thành sẽ bắt đầu một chuỗi mới.', overdue.id);
    } else {
      db.prepare("UPDATE student_streaks SET status = 'threatened', grace_deadline_at = ?, threatened_assignment_id = ?, updated_at = ? WHERE student_id = ?")
        .run(new Date(grace).toISOString(), overdue.id, nowIso(), streak.student_id);
      notify(streak.student_id, 'streak_threatened', 'Chuỗi thành tích của bạn đang có nguy cơ bị gián đoạn', `Nhiệm vụ “${overdue.title}” đã quá hạn. Hãy hoàn thành trong vòng 24 giờ để duy trì chuỗi.`, overdue.id);
      notify(overdue.teacher_id, 'student_streak_threatened', 'Chuỗi thành tích của học sinh có nguy cơ bị gián đoạn', `Một học sinh có nhiệm vụ đã quá hạn: “${overdue.title}”.`, overdue.id);
    }
  }
}

/** Remove visible pencil-history rows after 30 days while lifetime balances and reward claims remain. */
export function cleanupExpiredPencilHistory() {
  return withDb(() => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = db.prepare('DELETE FROM pencil_ledger WHERE created_at < ?').run(cutoff);
    return Number(result.changes);
  });
}

export function studentRewards(studentId: string) {
  return withDb(() => {
    sweepStreaksLocked();
    ensureStreak(studentId);
    const teacher = db.prepare('SELECT c.teacher_id FROM class_members m JOIN classes c ON c.id = m.class_id WHERE m.student_id = ? LIMIT 1').get(studentId) as { teacher_id: string } | undefined;
    const streak = db.prepare('SELECT * FROM student_streaks WHERE student_id = ?').get(studentId) as { current_streak: number; status: string; grace_deadline_at: string | null; threatened_assignment_id: string | null };
    const total = db.prepare('SELECT COALESCE(total_pencils, 0) AS total FROM student_pencil_balances WHERE student_id = ?').get(studentId) as { total: number } | undefined;
    const historyCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recent = db.prepare('SELECT source, amount, note, created_at FROM pencil_ledger WHERE student_id = ? AND created_at >= ? ORDER BY created_at DESC').all(studentId, historyCutoff);
    const warning = streak.status === 'threatened' && streak.grace_deadline_at
      ? db.prepare('SELECT t.title FROM task_assignments a JOIN tasks t ON t.id = a.task_id WHERE a.id = ?').get(streak.threatened_assignment_id) as { title: string } | undefined
      : undefined;
    return {
      totalPencils: total?.total ?? 0,
      equivalentStars: total.total * 2,
      currentStreak: streak.current_streak,
      streakStatus: streak.status,
      graceDeadlineAt: streak.grace_deadline_at,
      threatenedTaskTitle: warning?.title || null,
      earlyRules: teacher ? getRules(teacher.teacher_id) : [],
      recent,
    };
  });
}

export function teacherRewards(teacherId: string) {
  return withDb(() => {
    sweepStreaksLocked();
    const students = db.prepare(`
      SELECT u.id, u.name, c.name AS class_name,
        COALESCE((SELECT b.total_pencils FROM student_pencil_balances b WHERE b.student_id = u.id), 0) AS total_pencils,
        COALESCE(s.current_streak, 0) AS current_streak,
        COALESCE(s.status, 'active') AS streak_status
      FROM users u JOIN class_members m ON m.student_id = u.id
      JOIN classes c ON c.id = m.class_id
      LEFT JOIN student_streaks s ON s.student_id = u.id
      WHERE c.teacher_id = ? ORDER BY c.name, u.name
    `).all(teacherId);
    const pendingReviews = db.prepare(`
      SELECT e.assignment_id, e.streak_number, u.name AS student_name, t.title, c.name AS class_name
      FROM streak_events e JOIN task_assignments a ON a.id = e.assignment_id
      JOIN tasks t ON t.id = a.task_id JOIN classes c ON c.id = t.class_id
      JOIN users u ON u.id = e.student_id
      WHERE t.teacher_id = ? AND e.review_required = 1 AND e.decision IS NULL
      ORDER BY e.submitted_at DESC
    `).all(teacherId);
    const settings = db.prepare('SELECT early_rules_json FROM reward_settings WHERE teacher_id = ?').get(teacherId) as { early_rules_json: string } | undefined;
    let earlyRules: EarlyRule[] = [];
    try { earlyRules = settings ? JSON.parse(settings.early_rules_json) : []; } catch { earlyRules = []; }
    return { students, pendingReviews, earlyRules };
  });
}

export function saveEarlyRewardRules(teacherId: string, raw: unknown) {
  if (!Array.isArray(raw)) throw new HttpError(400, 'Danh sách quy tắc thưởng không hợp lệ.');
  const rules = raw.map((value) => {
    const item = value as Record<string, unknown>;
    const hours = Number(item.hours);
    const pencils = Number(item.pencils);
    if (!Number.isInteger(hours) || hours < 1 || hours > 720 || !Number.isInteger(pencils) || pencils < 1 || pencils > 100) {
      throw new HttpError(400, 'Mỗi quy tắc cần số giờ nguyên (1–720) và số bút chì (1–100).');
    }
    return { hours, pencils };
  });
  if (new Set(rules.map((item) => item.hours)).size !== rules.length) throw new HttpError(400, 'Mỗi mốc thời gian nộp sớm phải khác nhau.');
  rules.sort((a, b) => b.hours - a.hours);
  return withDb(() => {
    db.prepare(`
      INSERT INTO reward_settings (teacher_id, early_rules_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(teacher_id) DO UPDATE SET early_rules_json = excluded.early_rules_json, updated_at = excluded.updated_at
    `).run(teacherId, JSON.stringify(rules), nowIso());
    return { earlyRules: rules };
  });
}

export function awardQualityPencils(teacherId: string, assignmentId: string, rawAmount: unknown) {
  const amount = Number(rawAmount ?? 0);
  if (!Number.isInteger(amount) || amount < 0 || amount > 100) throw new HttpError(400, 'Thưởng chất lượng phải từ 0 đến 100 bút chì.');
  return withDb(() => {
    const row = db.prepare(`
      SELECT a.student_id, t.title FROM task_assignments a JOIN tasks t ON t.id = a.task_id
      JOIN task_completions c ON c.assignment_id = a.id
      WHERE a.id = ? AND t.teacher_id = ?
    `).get(assignmentId, teacherId) as { student_id: string; title: string } | undefined;
    if (!row) throw new HttpError(404, 'Không tìm thấy nhiệm vụ đã được duyệt.');
    if (amount) addLedger(row.student_id, teacherId, assignmentId, 'quality', amount, `Quality reward: ${row.title}`);
    return { ok: true, awarded: amount };
  });
}

export function adjustStudentPencils(teacherId: string, studentId: string, rawAmount: unknown, rawNote: unknown) {
  const amount = Number(rawAmount);
  const note = String(rawNote ?? '').trim();
  if (!Number.isInteger(amount) || amount === 0 || amount < -1000 || amount > 1000) throw new HttpError(400, 'Mức điều chỉnh phải là số nguyên khác 0, từ -1000 đến 1000.');
  if (!note) throw new HttpError(400, 'Vui lòng nhập lý do điều chỉnh.');
  return withDb(() => {
    const owned = db.prepare('SELECT u.id FROM users u JOIN class_members m ON m.student_id = u.id JOIN classes c ON c.id = m.class_id WHERE u.id = ? AND c.teacher_id = ?').get(studentId, teacherId);
    if (!owned) throw new HttpError(404, 'Student not found.');
    addLedger(studentId, teacherId, null, 'adjustment', amount, note);
    return { ok: true };
  });
}

export function resetStudentStreak(teacherId: string, studentId: string) {
  return withDb(() => {
    const owned = db.prepare('SELECT u.id FROM users u JOIN class_members m ON m.student_id = u.id JOIN classes c ON c.id = m.class_id WHERE u.id = ? AND c.teacher_id = ?').get(studentId, teacherId);
    if (!owned) throw new HttpError(404, 'Student not found.');
    ensureStreak(studentId);
    db.prepare("UPDATE student_streaks SET current_streak = 0, status = 'broken', grace_deadline_at = NULL, threatened_assignment_id = NULL, updated_at = ? WHERE student_id = ?").run(nowIso(), studentId);
    notify(studentId, 'streak_teacher_reset', 'Chuỗi thành tích của bạn đã được đặt lại', 'Giáo viên đã đặt lại chuỗi nhiệm vụ hiện tại của bạn.', `teacher-reset:${nowIso()}`);
    return { ok: true };
  });
}

export function resolveStreakReview(teacherId: string, assignmentId: string, rawDecision: unknown) {
  const decision = String(rawDecision);
  if (decision !== 'keep' && decision !== 'break') throw new HttpError(400, 'Hãy chọn tiếp tục hoặc đặt lại chuỗi.');
  return withDb(() => {
    const row = db.prepare(`
      SELECT e.student_id, e.streak_bonus, e.streak_number, t.title
      FROM streak_events e JOIN task_assignments a ON a.id = e.assignment_id
      JOIN tasks t ON t.id = a.task_id
      WHERE e.assignment_id = ? AND t.teacher_id = ? AND e.review_required = 1 AND e.decision IS NULL
    `).get(assignmentId, teacherId) as { student_id: string; streak_bonus: number; streak_number: number; title: string } | undefined;
    if (!row) throw new HttpError(404, 'Không tìm thấy yêu cầu xem xét chuỗi.');
    db.prepare('UPDATE streak_events SET review_required = 0, decision = ? WHERE assignment_id = ?').run(decision, assignmentId);
    if (decision === 'break') {
      ensureStreak(row.student_id);
      db.prepare("UPDATE student_streaks SET current_streak = 0, status = 'broken', grace_deadline_at = NULL, threatened_assignment_id = NULL, updated_at = ? WHERE student_id = ?").run(nowIso(), row.student_id);
      if (row.streak_bonus) addLedger(row.student_id, teacherId, assignmentId, 'streak_reversal', -row.streak_bonus, 'Teacher revoked streak reward');
      notify(row.student_id, 'streak_teacher_decision', 'Giáo viên đã đặt lại chuỗi', `Giáo viên quyết định không tiếp tục duy trì chuỗi cho nhiệm vụ “${row.title}”.`, assignmentId);
    } else {
      notify(row.student_id, 'streak_teacher_decision', 'Chuỗi thành tích được tiếp tục', `Giáo viên cho phép bạn tiếp tục duy trì chuỗi sau khi chỉnh sửa bài “${row.title}”.`, assignmentId);
    }
    return { ok: true, decision };
  });
}
