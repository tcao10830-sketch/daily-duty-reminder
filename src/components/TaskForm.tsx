import { useState } from 'react';
import type { NoteColor, Priority, Recurrence } from '../types';
import { Button, Field, controlClass } from './ui';
import { hcmToday } from '../lib/format';

export type TaskFormValues = {
  title: string;
  description: string;
  instructions: string;
  classId: string;
  studentId: string;
  assignmentDate: string;
  deadlineDate: string;
  deadlineTime: string;
  priority: Priority;
  penalty: string;
  color: NoteColor;
  recurrence: Recurrence;
  weekdays: number[];
  customDates: string[];
  horizonDays: number;
  applyToSeries: boolean;
};

const colors: NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'orange', 'purple'];
const swatch: Record<NoteColor, string> = {
  yellow: '#FFF3B0',
  pink: '#FFD6E0',
  blue: '#D6E6FF',
  green: '#D8F6E4',
  orange: '#FFE0C2',
  purple: '#E6D9FF',
};
const days = [
  [1, 'Thứ 2'],
  [2, 'Thứ 3'],
  [3, 'Thứ 4'],
  [4, 'Thứ 5'],
  [5, 'Thứ 6'],
  [6, 'Thứ 7'],
  [0, 'Chủ nhật'],
];

export function emptyTaskForm(classId = ''): TaskFormValues {
  const today = hcmToday();
  return {
    title: '',
    description: '',
    instructions: '',
    classId,
    studentId: '',
    assignmentDate: today,
    deadlineDate: today,
    deadlineTime: '20:00',
    priority: 'medium',
    penalty: '',
    color: 'yellow',
    recurrence: 'once',
    weekdays: [1, 2, 3, 4, 5],
    customDates: [],
    horizonDays: 14,
    applyToSeries: false,
  };
}

export function TaskForm({
  mode,
  classes,
  initial,
  busy,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  classes: { id: string; name: string; students: { id: string; name: string }[] }[];
  initial: TaskFormValues;
  busy: boolean;
  onSubmit: (values: TaskFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);
  const [extraDate, setExtraDate] = useState('');
  const students = classes.find((item) => item.id === values.classId)?.students ?? [];

  function set<K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="grid gap-4 rounded-3xl bg-white p-5 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(values);
      }}
    >
      <Field label="Tên nhiệm vụ">
        <input className={controlClass} value={values.title} onChange={(event) => set('title', event.target.value)} required />
      </Field>
      <Field label="Mô tả">
        <textarea className={controlClass} rows={3} value={values.description} onChange={(event) => set('description', event.target.value)} />
      </Field>
      <Field label="Hướng dẫn bổ sung">
        <textarea className={controlClass} rows={2} value={values.instructions} onChange={(event) => set('instructions', event.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Lớp được giao">
          <select
            className={controlClass}
            value={values.classId}
            onChange={(event) => setValues((current) => ({ ...current, classId: event.target.value, studentId: '' }))}
            required
            disabled={mode === 'edit'}
          >
            <option value="">Chọn lớp</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Học sinh được giao (không bắt buộc)">
          <select className={controlClass} value={values.studentId} onChange={(event) => set('studentId', event.target.value)} disabled={mode === 'edit'}>
            <option value="">Cả lớp</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Ngày giao">
          <input className={controlClass} type="date" value={values.assignmentDate} onChange={(event) => set('assignmentDate', event.target.value)} required />
        </Field>
        <Field label="Ngày đến hạn">
          <input className={controlClass} type="date" value={values.deadlineDate} onChange={(event) => set('deadlineDate', event.target.value)} required />
        </Field>
        <Field label="Giờ đến hạn">
          <input className={controlClass} type="time" value={values.deadlineTime} onChange={(event) => set('deadlineTime', event.target.value)} required />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mức độ ưu tiên">
          <select className={controlClass} value={values.priority} onChange={(event) => set('priority', event.target.value as Priority)}>
            <option value="low">Thấp</option>
            <option value="medium">Trung bình</option>
            <option value="high">Cao</option>
          </select>
        </Field>
        <Field label="Hình phạt khi quá hạn">
          <input className={controlClass} value={values.penalty} onChange={(event) => set('penalty', event.target.value)} placeholder="Giáo viên nhập hình phạt" />
        </Field>
      </div>
      <div>
        <p className="mb-2 text-sm font-extrabold">Màu ghi chú</p>
        <div className="flex flex-wrap gap-2">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              onClick={() => set('color', color)}
              className={`h-9 w-9 rounded-full border-2 ${values.color === color ? 'border-[#24324a]' : 'border-white'}`}
              style={{ background: swatch[color] }}
            />
          ))}
        </div>
      </div>
      {mode === 'create' ? (
        <div className="grid gap-3">
          <Field label="Lịch lặp lại">
            <select className={controlClass} value={values.recurrence} onChange={(event) => set('recurrence', event.target.value as Recurrence)}>
              <option value="once">Một lần</option>
              <option value="daily">Hằng ngày</option>
              <option value="weekly">Hằng tuần</option>
              <option value="custom">Ngày tùy chọn</option>
            </select>
          </Field>
          {values.recurrence === 'daily' || values.recurrence === 'weekly' ? (
            <Field label="Tạo trước bao nhiêu ngày">
              <input
                className={controlClass}
                type="number"
                min={1}
                max={31}
                value={values.horizonDays}
                onChange={(event) => set('horizonDays', Number(event.target.value))}
              />
            </Field>
          ) : null}
          {values.recurrence === 'weekly' ? (
            <div className="flex flex-wrap gap-2">
              {days.map(([day, label]) => {
                const selected = values.weekdays.includes(Number(day));
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      set(
                        'weekdays',
                        selected ? values.weekdays.filter((item) => item !== day) : [...values.weekdays, Number(day)],
                      )
                    }
                    className={`rounded-full px-3 py-1.5 text-sm font-extrabold ${selected ? 'bg-[#4F87FF] text-white' : 'bg-[#eef4ff]'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null}
          {values.recurrence === 'custom' ? (
            <div>
              <div className="flex gap-2">
                <input className={controlClass} type="date" value={extraDate} onChange={(event) => setExtraDate(event.target.value)} />
                <Button
                  onClick={() => {
                    if (!extraDate || values.customDates.includes(extraDate)) return;
                    set('customDates', [...values.customDates, extraDate].sort());
                    setExtraDate('');
                  }}
                >
                  Add date
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {values.customDates.map((date) => (
                  <button key={date} type="button" className="rounded-full bg-[#FFF3B0] px-3 py-1 text-sm font-extrabold" onClick={() => set('customDates', values.customDates.filter((item) => item !== date))}>
                    {date} ×
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <p className="text-sm font-bold text-slate-500">Nhiệm vụ hằng ngày và hằng tuần sẽ tạo một ghi chú cho mỗi ngày phù hợp. Một ngày sẽ không bị thêm trùng.</p>
        </div>
      ) : (
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" checked={values.applyToSeries} onChange={(event) => set('applyToSeries', event.target.checked)} />
          Apply title, instructions, penalty, color, and deadline time to later tasks in this series
        </label>
      )}
      <Button type="submit" disabled={busy} testId="save-task">
        {busy ? 'Đang lưu…' : mode === 'create' ? 'Giao nhiệm vụ' : 'Lưu thay đổi'}
      </Button>
    </form>
  );
}
