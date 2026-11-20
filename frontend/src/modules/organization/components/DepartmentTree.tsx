import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Badge, Button, buttonStyles } from "@/components/ui";
import { cx } from "@/lib/cx";
import { tr } from "@/i18n/translate";
import type { Department, DepartmentNode } from "../types";

interface NodeProps {
    node: DepartmentNode;
    stats: Map<number, Department>;
    collapsed: ReadonlySet<number>;
    onToggle: (id: number) => void;
    onEdit: (department: Department) => void;
}

function TreeNode({ node, stats, collapsed, onToggle, onEdit }: NodeProps) {
    const { t } = useTranslation();
    const info = stats.get(node.id);
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(node.id);

    return (
        <li>
            <div
                className={cx(
                    "flex flex-wrap items-center gap-3 border-2 border-ink px-3 py-2",
                    node.is_active ? "bg-paper" : "bg-gray-light",
                )}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={() => onToggle(node.id)}
                        aria-expanded={!isCollapsed}
                        aria-label={t(isCollapsed ? "Déplier {{name}}" : "Replier {{name}}", { name: node.name })}
                        className="border-2 border-ink p-0.5 hover:bg-ink hover:text-paper"
                    >
                        {isCollapsed ? (
                            <ChevronRight className="size-4" aria-hidden="true" />
                        ) : (
                            <ChevronDown className="size-4" aria-hidden="true" />
                        )}
                    </button>
                ) : (
                    <span className="size-6" aria-hidden="true" />
                )}
                <span className="font-bold">{node.code}</span>
                <span>{node.name}</span>
                {!node.is_active && <Badge tone="muted">{tr("Inactif")}</Badge>}
                {info && (
                    <span className="ml-auto text-sm text-gray-dark">
                        {t("{{count}} employé", { count: info.employees_count })} · {t("{{count}} poste", { count: info.positions_count })}
                    </span>
                )}
                <Link
                    to={`/employees?department=${node.id}`}
                    className={buttonStyles({ variant: "ghost", size: "sm", className: info ? undefined : "ml-auto" })}
                >
                    {t("Employés")}
                </Link>
                {info && (
                    <Button size="sm" variant="secondary" onClick={() => onEdit(info)}>
                        Modifier
                    </Button>
                )}
            </div>
            {hasChildren && !isCollapsed && (
                <ul className="ml-5 mt-2 space-y-2 border-l-2 border-ink pl-4">
                    {node.children.map((child) => (
                        <TreeNode key={child.id} node={child} stats={stats} collapsed={collapsed} onToggle={onToggle} onEdit={onEdit} />
                    ))}
                </ul>
            )}
        </li>
    );
}

/** Organization chart: the department hierarchy, with headcounts. */
export function DepartmentTree({
    nodes,
    stats,
    onEdit,
}: {
    nodes: DepartmentNode[];
    stats: Map<number, Department>;
    onEdit: (department: Department) => void;
}) {
    const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set());

    function toggle(id: number) {
        setCollapsed((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    return (
        <ul className="space-y-2">
            {nodes.map((node) => (
                <TreeNode key={node.id} node={node} stats={stats} collapsed={collapsed} onToggle={toggle} onEdit={onEdit} />
            ))}
        </ul>
    );
}
