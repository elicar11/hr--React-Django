import { Route, Routes } from "react-router";
import { NotFoundPage } from "@/modules/core/pages/NotFoundPage";
import { SetupCheckPage } from "@/modules/core/pages/SetupCheckPage";

export function App() {
    return (
        <Routes>
            <Route path="/" element={<SetupCheckPage />} />
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
}