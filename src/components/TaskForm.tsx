import { useState } from 'react';
import type { NoteColor, Mức độ ưu tiên, Recurrence } from '../types';
import { Button, Field, controlLớp } from './ui';
import { hcmHôm nay } from '../lib/format';

export type Nhiệm vụFormValues = {
  title: string;
  description: string;
  instructions: string;
  classId: string;
  studentId: string;
  assignmentDate: string;
  deadlineDate: string;
  deadlineTime: string;
  priority: Mức độ ưu tiên;
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
  [1, 'T2'],
  [2, 'T3'],
  [3, 'T4'],
  [4, 'T5'],
  [5, 'T6'],
  [6, 'T7'],
  [0, 'CN'],
];

export function emptyNhiệm vụForm(classId = ''): Nhiệm vụFormValues {
  const today = hcmHôm nay();
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

export function Nhiệm vụForm({
  mode,
  classes,
  initial,
  busy,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  classes: { id: string; name: string; học sinh: { id: string; name: string }[] }[];
  initial: Nhiệm vụFormValues;
  busy: boolean;
  onSubmit: (values: Nhiệm vụFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);
  const [extraDate, setExtraDate] = useState('');
  const học sinh = classes.find((item) => item.id === values.classId)?.học sinh ?? [];

  function set<K extends keyof Nhiệm vụFormValues>(key: K, value: Nhiệm vụFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      classHọ và tên="grid gap-4 rounded-3xl bg-white p-5 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(values);
      }}
    >
      <Field label="Tên nhiệm vụ">
        <input classHọ và tên={controlLớp} value={values.title} onChange={(event) => set('title', event.target.value)} required />
      </Field>
      <Field label="Mô tả">
        <textarea classHọ và tên={controlLớp} rows={3} value={values.description} onChange={(event) => set('description', event.target.value)} />
      </Field>
      <Field label="Hướng dẫn bổ sung">
        <textarea classHọ và tên={controlLớp} rows={2} value={values.instructions} onChange={(event) => set('instructions', event.target.value)} />
      </Field>
      <div classHọ và tên="grid gap-4 sm:grid-cols-2">
        <Field label="Lớp được giao">
          <select
            classHọ và tên={controlLớp}
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
          <select classHọ và tên={controlLớp} value={values.studentId} onChange={(event) => set('studentId', event.target.value)} disabled={mode === 'edit'}>
            <option value="">Cả lớp</option>
            {học sinh.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div classHọ và tên="grid gap-4 sm:grid-cols-3">
        <Field label="Ngày giao">
          <input classHọ và tên={controlLớp} type="date" value={values.assignmentDate} onChange={(event) => set('assignmentDate', event.target.value)} required />
        </Field>
        <Field label="Ngày đến hạn">
          <input classHọ và tên={controlLớp} type="date" value={values.deadlineDate} onChange={(event) => set('deadlineDate', event.target.value)} required />
        </Field>
        <Field label="Giờ đến hạn">
          <input classHọ và tên={controlLớp} type="time" value={values.deadlineTime} onChange={(event) => set('deadlineTime', event.target.value)} required />
        </Field>
      </div>
      <div classHọ và tên="grid gap-4 sm:grid-cols-2">
        <Field label="Mức độ ưu tiên">
          <select classHọ và tên={controlLớp} value={values.priority} onChange={(event) => set('priority', event.target.value as Mức độ ưu tiên)}>
            <option value="low">Thấp</option>
            <option value="medium">Trung bình</option>
            <option value="high">Cao</option>
          </select>
        </Field>
        <Field label="Hình phạt khi quá hạn">
          <input classHọ và tên={controlLớp} value={values.penalty} onChange={(event) => set('penalty', event.target.value)} placeholder="Giáo viên nhập hình phạt" />
        </Field>
      </div>
      <div>
        <p classHọ và tên="mb-2 text-sm font-extrabold">Màu ghi chú</p>
        <div classHọ và tên="flex flex-wrap gap-2">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              onClick={() => set('color', color)}
              classHọ và tên={`h-9 w-9 rounded-full border-2 ${values.color === color ? 'border-[#24324a]' : 'border-white'}`}
              style={{ background: swatch[color] }}
            />
          ))}
        </div>
      </div>
      {mode === 'create' ? (
        <div classHọ và tên="grid gap-3">
          <Field label="Lịch lặp lại">
            <select classHọ và tên={controlLớp} value={values.recurrence} onChange={(event) => set('recurrence', event.target.value as Recurrence)}>
              <option value="once">Một lần</option>
              <option value="daily">Hằng ngày</option>
              <option value="weekly">Hằng tuần</option>
              <option value="custom">Ngày tùy chọn</option>
            </select>
          </Field>
          {values.recurrence === 'daily' || values.recurrence === 'weekly' ? (
            <Field label="Tạo trước bao nhiêu ngày">
              <input
                classHọ và tên={controlLớp}
                type="number"
                min={1}
                max={31}
                value={values.horizonDays}
                onChange={(event) => set('horizonDays', Number(event.target.value))}
              />
            </Field>
          ) : null}
          {values.recurrence === 'weekly' ? (
            <div classHọ và tên="flex flex-wrap gap-2">
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
                    classHọ và tên={`rounded-full px-3 py-1.5 text-sm font-extrabold ${selected ? 'bg-[#4F87FF] text-white' : 'bg-[#eef4ff]'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null}
          {values.recurrence === 'custom' ? (
            <div>
              <div classHọ và tên="flex gap-2">
                <input classHọ và tên={controlLớp} type="date" value={extraDate} onChange={(event) => setExtraDate(event.target.value)} />
                <Button
                  onClick={() => {
                    if (!extraDate || values.customDates.includes(extraDate)) return;
                    set('customDates', [...values.customDates, extraDate].sort());
                    setExtraDate('');
                  }}
                >
                  Thêm ngày
                </Button>
              </div>
              <div classHọ và tên="mt-2 flex flex-wrap gap-2">
                {values.customDates.map((date) => (
                  <button key={date} type="button" classHọ và tên="rounded-full bg-[#FFF3B0] px-3 py-1 text-sm font-extrabold" onClick={() => set('customDates', values.customDates.filter((item) => item !== date))}>
                    {date} ×
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <p classHọ và tên="text-sm font-bold text-slate-500">Hằng ngày and weekly tasks create one note per matching day. The same day is never added twice.</p>
        </div>
      ) : (
        <label classHọ và tên="flex items-center gap-2 font-bold">
          <input type="checkbox" checked={values.applyToSeries} onChange={(event) => set('applyToSeries', event.target.checked)} />
          Áp dụng tên, hướng dẫn, hình phạt, màu sắc và giờ đến hạn cho các nhiệm vụ tiếp theo trong chuỗi này
        </label>
      )}
      <Button type="submit" disabled={busy} testId="save-task">
        {busy ? 'Đang lưu…' : mode === 'create' ? 'Giao nhiệm vụ' : 'Lưu changes'}
      </Button>
    </form>
  );
}
