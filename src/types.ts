export type Role = 'teacher' | 'student';
export type Priority = 'low' | 'medium' | 'high';
export type Recurrence = 'once' | 'daily' | 'weekly' | 'custom';
export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'purple';
export type CompletionStatus = 'pending' | 'on_time' | 'late' | 'overdue';

export type User = { id: string; name: string; email: string; role: Role };

export type AssignmentCard = {
  assignmentId: string;
  taskId: string;
  seriesId: string;
  title: string;
  description: string;
  instructions: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  assignmentDate: string;
  deadlineDate: string;
  deadlineTime: string;
  deadlineAt: string;
  priority: Priority;
  penalty: string;
  color: NoteColor;
  recurrence: Recurrence;
  taskStatus: 'active' | 'cancelled';
  inProgress: boolean;
  submittedAt: string | null;
  submissionPending: boolean;
  revisionDeadlineAt: string | null;
  completedAt: string | null;
  status: CompletionStatus;
};

export type TaskSummary = {
  id: string;
  seriesId: string;
  classId: string;
  className: string;
  title: string;
  description: string;
  instructions: string;
  priority: Priority;
  penalty: string;
  assignmentDate: string;
  deadlineDate: string;
  deadlineTime: string;
  deadlineAt: string;
  recurrence: Recurrence;
  color: NoteColor;
  taskStatus: 'active' | 'cancelled';
  assignedCount: number;
  completedCount: number;
  pendingCount: number;
  overdueCount: number;
  completionRate: number;
  studentNames?: string[];
};

export type ClassSummary = {
  id: string;
  name: string;
  studentCount: number;
  students: { id: string; name: string }[];
  assignedCount: number;
  completedCount: number;
  pendingCount: number;
  overdueCount: number;
  completionRate: number;
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

export type WeekPoint = { date: string; count: number };

export const STATUS_LABEL: Record<CompletionStatus, string> = {
  pending: 'Chưa hoàn thành',
  on_time: 'Đã hoàn thành đúng hạn',
  late: 'Đã hoàn thành muộn',
  overdue: 'Quá hạn',
};
