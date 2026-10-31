import { api, fetchAllPages, fetchPage, type Page } from "@/lib/api";
import type { Holiday, ScheduleAssignment, WorkSchedule, WorkScheduleInput } from "../types";

export type ListQuery = Record<string, string | number | undefined>;

// --- Work schedules ----------------------------------------------------------------------------------------

export function listSchedules(params: ListQuery, signal?: AbortSignal): Promise<Page<WorkSchedule>> {
    return fetchPage<WorkSchedule>("/work-schedules/", params, signal);
}

export function getAllSchedules(signal?: AbortSignal): Promise<WorkSchedule[]> {
    return fetchAllPages<WorkSchedule>("/work-schedules/", {}, signal);
}

export async function createSchedule(input: WorkScheduleInput): Promise<WorkSchedule> {
    const { data } = await api.post<WorkSchedule>("/work-schedules/", input);
    return data;
}

export async function updateSchedule(id: number, input: Partial<WorkScheduleInput>): Promise<WorkSchedule> {
    const { data } = await api.patch<WorkSchedule>(`/work-schedules/${id}/`, input);
    return data;
}

export async function deleteSchedule(id: number): Promise<void> {
    await api.delete(`/work-schedules/${id}/`);
}

export async function setDefaultSchedule(id: number): Promise<WorkSchedule> {
    const { data } = await api.post<WorkSchedule>(`/work-schedules/${id}/set-default/`);
    return data;
}

// --- Assignments (schedule of an employee over time) -------------------------------------------------------

export function listAssignments(params: ListQuery, signal?: AbortSignal): Promise<Page<ScheduleAssignment>> {
    return fetchPage<ScheduleAssignment>("/schedule-assignments/", params, signal);
}

export async function createAssignment(input: {
    employee: number;
    schedule: number;
    start_date: string;
}): Promise<ScheduleAssignment> {
    const { data } = await api.post<ScheduleAssignment>("/schedule-assignments/", input);
    return data;
}

// --- Holidays -----------------------------------------------------------------------------------------------------

export function listHolidays(params: ListQuery, signal?: AbortSignal): Promise<Page<Holiday>> {
    return fetchPage<Holiday>("/holidays/", params, signal);
}

export async function createHoliday(input: Omit<Holiday, "id">): Promise<Holiday> {
    const { data } = await api.post<Holiday>("/holidays/", input);
    return data;
}

export async function updateHoliday(id: number, input: Partial<Omit<Holiday, "id">>): Promise<Holiday> {
    const { data } = await api.patch<Holiday>(`/holidays/${id}/`, input);
    return data;
}

export async function deleteHoliday(id: number): Promise<void> {
    await api.delete(`/holidays/${id}/`);
}