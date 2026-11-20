// English dictionary: the key is the French source text, exactly as written in the code.
import { enI2 } from "./en.i2";
import { enEmployees } from "./en.employees";
import { enOrganization } from "./en.organization";
import { enContracts } from "./en.contracts";
import { enAttendance } from "./en.attendance";
import { enLeaves } from "./en.leaves";
import { enPayroll } from "./en.payroll";
import { enAdmin } from "./en.admin";
import { enAudit } from "./en.audit";
import { enApi } from "./en.api";

export const en: Record<string, string> = {
    // --- Navigation ---------------------------------------------------------------------------------------
    "Personnel": "People",
    "Temps de travail": "Working time",
    "Journal d'audit": "Audit log",
    "Mes présences": "My attendance",
    "Navigation principale": "Main navigation",
    "Menu de navigation": "Navigation menu",
    "HR, retour au tableau de bord": "HR, back to the dashboard",
    "Réduire": "Collapse",
    "Réduire le menu": "Collapse menu",
    "Déployer le menu": "Expand menu",

    // --- Top bar ---------------------------------------------------------------------------------------------
    "Ouvrir le menu": "Open menu",
    "Rechercher un employé": "Search for an employee",
    "Rechercher un employé…": "Search for an employee…",
    "Menu du profil": "Profile menu",
    "Mon compte": "My account",
    "Mon profil": "My profile",
    "Se déconnecter": "Sign out",
    "Langue": "Language",

    // --- Roles -----------------------------------------------------------------------------------------------

    // --- Error screen -------------------------------------------------------------------------------------------
    "Une erreur est survenue": "Something went wrong",
    "Cette page n'a pas pu s'afficher. Vos données ne sont pas perdues : rechargez la page ou revenez à l'accueil. Si le problème persiste, contactez l'administrateur.":
        "This page could not be displayed. Your data is not lost: reload the page or go back to the home page. If the problem persists, contact the administrator.",
    "Recharger la page": "Reload the page",
    "Retour à l'accueil": "Back to home",


    ...enI2,
    ...enEmployees,
    ...enOrganization,
    ...enContracts,
    ...enAttendance,
    ...enLeaves,
    ...enPayroll,
    ...enAdmin,
    ...enAudit,
    ...enApi,
};
