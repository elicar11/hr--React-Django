import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, FileText, Pencil, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
    ActiveBadge,
    Alert,
    Button,
    Card,
    Checkbox,
    ConfirmDialog,
    DataTable,
    DateField,
    DefinitionList,
    EmptyState,
    FileUpload,
    FilterBar,
    FormSection,
    Input,
    Menu,
    Modal,
    PageHeader,
    Pagination,
    Popover,
    RowActions,
    SearchInput,
    Select,
    Skeleton,
    Spinner,
    StatCard,
    StatusBadge,
    TabPanel,
    Tabs,
    Textarea,
    type StatusDomain,
} from "@/components/ui";
import { notify } from "@/lib/notify";

// --- react-hook-form + zod demo (also checks the dependency versions) -------------------------
const schema = z.object({
    email: z.email("Adresse e-mail invalide."),
    department: z.string().min(1, "Choisissez un département."),
    hire_date: z.string().min(1, "La date d'embauche est obligatoire."),
    comment: z.string().max(200, "200 caractères maximum."),
    newsletter: z.boolean(),
});
type DemoForm = z.infer<typeof schema>;

// --- table demo ----------------------------------------------------------------------------------
interface DemoEmployee {
    id: number;
    matricule: string;
    name: string;
    department: string;
    hire_date: string;
    status: string;
}

const EMPLOYEES: DemoEmployee[] = [
    { id: 1, matricule: "EMP-001", name: "Rivière Rina", department: "Ressources humaines", hire_date: "2022-03-14", status: "ACTIVE" },
    { id: 2, matricule: "EMP-002", name: "Martin Louis", department: "Comptabilité", hire_date: "2023-09-01", status: "SUSPENDED" },
    { id: 3, matricule: "EMP-003", name: "Dupont Chloé", department: "Informatique", hire_date: "2021-01-25", status: "ACTIVE" },
    { id: 4, matricule: "EMP-004", name: "Bernard Hugo", department: "Informatique", hire_date: "2019-06-10", status: "TERMINATED" },
];

const columns: ColumnDef<DemoEmployee>[] = [
    { accessorKey: "matricule", header: "Matricule" },
    { accessorKey: "name", header: "Nom" },
    { accessorKey: "department", header: "Département" },
    { accessorKey: "hire_date", header: "Embauche" },
    {
        accessorKey: "status",
        header: "Statut",
        cell: ({ getValue }) => <StatusBadge domain="employee" status={String(getValue())} />,
    },
    {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
            <RowActions
                label={`Actions pour ${row.original.name}`}
                items={[
                    { label: "Voir la fiche", icon: Eye, onSelect: () => notify.info(`Fiche de ${row.original.name}`) },
                    { label: "Modifier", icon: Pencil, onSelect: () => notify.info("Modifier") },
                    { label: "Sortir de l'effectif", icon: Trash2, tone: "danger", separatorBefore: true, onSelect: () => notify.info("Sortie") },
                ]}
            />
        ),
    },
];

const STATUS_SAMPLES: Record<StatusDomain, string[]> = {
    employee: ["ACTIVE", "SUSPENDED", "TERMINATED"],
    contract: ["DRAFT", "ACTIVE", "ENDED", "TERMINATED"],
    leave: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
    correction: ["PENDING", "APPROVED"],
    payslip: ["DRAFT", "CALCULATED", "VALIDATED", "PAID", "CANCELLED"],
    period: ["OPEN", "CLOSED"],
    attendance: ["PRESENT", "ABSENT_JUSTIFIED", "ABSENT_UNJUSTIFIED"],
};

const TABS = [
    { id: "general", label: "Général" },
    { id: "contracts", label: "Contrats", icon: FileText },
    { id: "history", label: "Historique" },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function UiKitPage() {
    const [modalOpen, setModalOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [reasonOpen, setReasonOpen] = useState(false);
    const [tab, setTab] = useState("general");
    const [page, setPage] = useState(3);
    const [search, setSearch] = useState("");
    const [file, setFile] = useState<File | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<DemoForm>({ resolver: zodResolver(schema), defaultValues: { newsletter: false } });

    async function onSubmit(values: DemoForm) {
        await wait(600);
        notify.success("Formulaire valide", `E-mail : ${values.email}`);
    }

    return (
        <>
            <PageHeader
                title="Kit de composants"
                description="Page de démonstration (développement uniquement). Teste chaque composant au clavier et sur mobile."
                breadcrumb={[{ label: "Accueil", to: "/" }, { label: "Kit UI" }]}
                actions={<Button onClick={() => setModalOpen(true)}>Ouvrir une modale</Button>}
            />

            <div className="space-y-8">
                <Alert tone="warning" title="DÉMO : paramètres fictifs">
                    Exemple du bandeau permanent de la paie : non utilisable pour une paie réelle.
                </Alert>

                <Card title="Boutons et alertes">
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <Button>Principal</Button>
                            <Button variant="secondary">Secondaire</Button>
                            <Button variant="ghost">Discret</Button>
                            <Button variant="danger">Danger</Button>
                            <Button loading>Chargement</Button>
                            <Button disabled>Désactivé</Button>
                            <Button size="sm">Petit</Button>
                            <Button size="lg">Grand</Button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <Alert tone="info" title="Information">Message informatif.</Alert>
                            <Alert tone="success" title="Succès">Opération réussie.</Alert>
                            <Alert tone="error" title="Erreur">Un problème est survenu.</Alert>
                            <div className="flex items-center gap-4 border-2 border-ink p-4">
                                <Spinner size="lg" /> <span>Spinner</span> <Skeleton className="h-5 w-32" />
                            </div>
                        </div>
                    </div>
                </Card>

                <Card title="Indicateurs">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Employés actifs" value={128} hint="Au total" icon={Users} to="/employees" />
                        <StatCard label="Congés en attente" value={7} />
                        <StatCard label="Chargement" value={0} loading />
                        <StatCard label="Contrats à échéance" value={3} hint="Sous 30 jours" />
                    </div>
                </Card>

                <Card title="Badges de statut" description="Distingués par la forme, l'icône et le contraste, pas seulement par la couleur.">
                    <div className="space-y-3">
                        {(Object.keys(STATUS_SAMPLES) as StatusDomain[]).map((domain) => (
                            <div key={domain} className="flex flex-wrap items-center gap-2">
                                <span className="w-28 text-xs font-bold uppercase tracking-widest">{domain}</span>
                                {STATUS_SAMPLES[domain].map((status) => (
                                    <StatusBadge key={status} domain={domain} status={status} />
                                ))}
                            </div>
                        ))}
                        <div className="flex items-center gap-2">
                            <span className="w-28 text-xs font-bold uppercase tracking-widest">actif</span>
                            <ActiveBadge active /> <ActiveBadge active={false} />
                        </div>
                    </div>
                </Card>

                <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <FormSection title="Formulaire (React Hook Form + Zod)" description="Envoie le formulaire vide pour voir les erreurs.">
                        <Input label="E-mail professionnel" type="email" required error={errors.email?.message} {...register("email")} />
                        <Select label="Département" required placeholder="Choisir…" error={errors.department?.message} {...register("department")}>
                            <option value="RH">Ressources humaines</option>
                            <option value="IT">Informatique</option>
                        </Select>
                        <DateField label="Date d'embauche" required error={errors.hire_date?.message} {...register("hire_date")} />
                        <Checkbox label="Recevoir les notifications" hint="Exemple de case à cocher." {...register("newsletter")} />
                        <Textarea className="md:col-span-2" label="Commentaire" hint="200 caractères maximum." error={errors.comment?.message} {...register("comment")} />
                        <div className="md:col-span-2">
                            <FileUpload label="Justificatif" accept=".pdf,.png,.jpg" maxSizeMb={5} file={file} onChange={setFile} />
                        </div>
                    </FormSection>
                    <Button type="submit" loading={isSubmitting}>
                        Enregistrer
                    </Button>
                </form>

                <Card title="Tableau, filtres et pagination">
                    <FilterBar canReset={search !== ""} onReset={() => setSearch("")}>
                        <SearchInput className="w-full max-w-xs" value={search} onChange={setSearch} />
                    </FilterBar>
                    <DataTable
                        caption="Employés (exemple)"
                        columns={columns}
                        data={EMPLOYEES.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))}
                        getRowId={(row) => String(row.id)}
                        onRowClick={(row) => notify.info(`Ligne : ${row.name}`)}
                        renderMobileCard={(row) => (
                            <div className="space-y-2">
                                <p className="font-bold">{row.name}</p>
                                <p className="text-sm text-gray-dark">{row.matricule} · {row.department}</p>
                                <StatusBadge domain="employee" status={row.status} />
                            </div>
                        )}
                    />
                    <Pagination page={page} count={135} onPageChange={setPage} />
                    <div className="mt-6 space-y-3">
                        <p className="text-sm font-bold uppercase tracking-wide">États : chargement et vide</p>
                        <DataTable caption="Chargement" columns={columns} data={[]} loading />
                        <DataTable
                            caption="Vide"
                            columns={columns}
                            data={[]}
                            emptyState={
                                <EmptyState
                                    icon={Users}
                                    title="Aucun employé"
                                    description="Commencez par créer le premier dossier."
                                    action={<Button>Ajouter un employé</Button>}
                                />
                            }
                        />
                    </div>
                </Card>

                <Card title="Onglets, menus et fenêtres">
                    <div className="space-y-5">
                        <Tabs idPrefix="demo" label="Fiche employé" items={TABS} value={tab} onChange={setTab} />
                        <TabPanel idPrefix="demo" id="general" active={tab === "general"}>
                            <DefinitionList
                                items={[
                                    { label: "Matricule", value: "EMP-001" },
                                    { label: "Département", value: "Ressources humaines" },
                                    { label: "Date d'embauche", value: "14/03/2022" },
                                    { label: "Téléphone", value: "" },
                                ]}
                            />
                        </TabPanel>
                        <TabPanel idPrefix="demo" id="contracts" active={tab === "contracts"}>
                            <p>Contenu de l'onglet « Contrats ».</p>
                        </TabPanel>
                        <TabPanel idPrefix="demo" id="history" active={tab === "history"}>
                            <p>Contenu de l'onglet « Historique ».</p>
                        </TabPanel>

                        <div className="flex flex-wrap gap-3">
                            <Menu
                                label="Menu d'exemple"
                                trigger="Menu"
                                triggerClassName="border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase hover:bg-ink hover:text-paper"
                                items={[
                                    { label: "Modifier", icon: Pencil, onSelect: () => notify.info("Modifier") },
                                    { label: "Supprimer", icon: Trash2, tone: "danger", separatorBefore: true, onSelect: () => setConfirmOpen(true) },
                                ]}
                            />
                            <Popover
                                label="Panneau d'exemple"
                                trigger="Panneau"
                                triggerClassName="border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase hover:bg-ink hover:text-paper"
                                panelClassName="w-72 p-4"
                            >
                                <p className="text-sm">Contenu libre : filtres, aide, détails…</p>
                            </Popover>
                            <Button variant="danger" onClick={() => setConfirmOpen(true)}>Confirmation simple</Button>
                            <Button variant="secondary" onClick={() => setReasonOpen(true)}>Confirmation avec motif</Button>
                        </div>
                    </div>
                </Card>
            </div>

            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Exemple de modale"
                description="Échap ou un clic à l'extérieur la ferme ; le focus est piégé à l'intérieur."
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setModalOpen(false)}>Fermer</Button>
                        <Button onClick={() => setModalOpen(false)}>Valider</Button>
                    </>
                }
            >
                <Input label="Champ dans la modale" />
            </Modal>

            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                tone="danger"
                title="Supprimer cet élément ?"
                message="Cette action est irréversible."
                confirmLabel="Supprimer"
                onConfirm={async () => {
                    await wait(600);
                    notify.success("Élément supprimé");
                }}
            />

            <ConfirmDialog
                open={reasonOpen}
                onClose={() => setReasonOpen(false)}
                tone="danger"
                title="Annuler le bulletin ?"
                message="Un motif est obligatoire. Il sera conservé dans l'historique."
                confirmLabel="Annuler le bulletin"
                reason={{ label: "Motif de l'annulation", required: true }}
                onConfirm={async (reason) => {
                    await wait(600);
                    notify.success("Bulletin annulé", reason);
                }}
            />
        </>
    );
}