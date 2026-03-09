"use client";
import Sidebar from "../components/Sidebar";

export default function DashboardLayout({ children }) {
    return (
        <div className="min-h-screen">
            <Sidebar />
            <main className="lg:ml-60 min-h-screen">
                {children}
            </main>
        </div>
    );
}
