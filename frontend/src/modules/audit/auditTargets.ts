const TARGET_LABELS: Record<string, string> = {
    "accounts.user": "Utilisateur",
    "organization.department": "Département",
    "organization.position": "Poste",
    "employees.employee": "Employé",
    "contracts.contract": "Contrat",
    "contracts.contracttype": "Type de contrat",
    "attendance.attendancerecord": "Présence",
    "attendance.attendancecorrection": "Correction de pointage",
    "attendance.workschedule": "Horaire de travail",
    "attendance.scheduleassignment": "Affectation d'horaire",
    "attendance.holiday": "Jour férié",
    "leaves.leaverequest": "Demande de congé",
    "leaves.leavetype": "Type de congé",
    "leaves.leavebalance": "Solde de congé",
    "payroll.payslip": "Bulletin",
    "payroll.payrollperiod": "Période de paie",
    "payroll.payitemtype": "Type d'élément de paie",
    "payroll.employeepayitem": "Élément de rémunération",
    "payroll.payrollsettings": "Paramètres de paie",
};

/** Screens that can show the audited object (only those that exist for a single object). */
const TARGET_ROUTES: Record<string, (id: string) => string> = {
    "employees.employee": (id) => `/employees/${id}`,
    "contracts.contract": (id) => `/contracts/${id}`,
    "leaves.leaverequest": (id) => `/leaves/${id}`,
    "payroll.payslip": (id) => `/payroll/payslips/${id}`,
    "payroll.payrollperiod": (id) => `/payroll/periods/${id}`,
};

export function targetLabel(type: string): string {
    return TARGET_LABELS[type] ?? type;
}

export function targetLink(type: string, id: string): string | null {
    return id && TARGET_ROUTES[type] ? TARGET_ROUTES[type](id) : null;
}

function formatValue(value: unknown): string {
    if (Array.isArray(value)) return value.map(formatValue).join(", ");
    if (value && typeof value === "object") return JSON.stringify(value);
    return String(value);
}

/** "fields: nom, ville · matricule: EMP-001": compact text of the recorded details. */
export function summarizeMetadata(metadata: Record<string, unknown>): string {
    return Object.entries(metadata)
        .map(([key, value]) => `${key} : ${formatValue(value)}`)
        .join(" · ");
}