// Pure decoration: no figures, so it cannot be mistaken for real data.
const HATCH = "repeating-linear-gradient(45deg, #000 0 2px, #fff 2px 7px)";
const BARS = [55, 80, 45, 100, 70, 90];
const TILES = ["Effectif", "Présences", "Congés"];

export function HeroPreview() {
    return (
        <div aria-hidden="true" className="border-2 border-ink bg-paper shadow-hard-lg">
            <div className="flex items-center gap-2 border-b-2 border-ink bg-ink px-3 py-2">
                <span className="size-3 border-2 border-paper" />
                <span className="size-3 border-2 border-paper" />
                <span className="size-3 border-2 border-paper" />
                <span className="ml-2 text-xs font-bold uppercase tracking-widest text-paper">Tableau de bord</span>
            </div>

            <div className="grid grid-cols-3 gap-3 p-4">
                {TILES.map((label) => (
                    <div key={label} className="space-y-2 border-2 border-ink p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest">{label}</p>
                        <div className="h-6 bg-ink" />
                        <div className="h-2 bg-gray-mid" />
                    </div>
                ))}
            </div>

            <div className="mx-4 mb-4 flex h-32 items-end gap-3 border-2 border-ink p-3">
                {BARS.map((height, index) => (
                    <div key={index} className="flex-1 border-2 border-ink" style={{ height: `${height}%`, background: HATCH }} />
                ))}
            </div>

            <div className="space-y-3 border-t-2 border-ink p-4">
                {[70, 55, 85].map((width, index) => (
                    <div key={index} className="flex items-center gap-3">
                        <span className="size-6 shrink-0 border-2 border-ink bg-gray-mid" />
                        <span className="h-2 bg-ink" style={{ width: `${width}%` }} />
                    </div>
                ))}
            </div>
        </div>
    );
}