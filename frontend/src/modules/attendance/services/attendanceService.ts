import { api } from "@/lib/api";
import type { AttendanceRecord } from "../types";

/** Self-service clock: the time is the server's, never sent by the client. */
export async function checkIn(): Promise<AttendanceRecord> {
    const { data } = await api.post<AttendanceRecord>("/attendance/check-in/");
    return data;
}

export async function checkOut(): Promise<AttendanceRecord> {
    const { data } = await api.post<AttendanceRecord>("/attendance/check-out/");
    return data;
}