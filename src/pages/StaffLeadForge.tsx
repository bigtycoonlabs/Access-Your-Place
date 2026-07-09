import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import LeadForge from "@/components/admin/LeadForge";

interface StaffSession {
  id?: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  department?: string;
  permissions?: string[];
  roles?: string[];
}

export default function StaffLeadForge() {
  const navigate = useNavigate();
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null);

  useEffect(() => {
    const rawSession = localStorage.getItem("staffSession");
    if (!rawSession) {
      navigate("/staff/login", { replace: true });
      return;
    }

    try {
      setStaffSession(JSON.parse(rawSession));
    } catch {
      localStorage.removeItem("staffSession");
      navigate("/staff/login", { replace: true });
    }
  }, [navigate]);

  if (!staffSession) {
    return (
      <div className="min-h-screen bg-[#080D18] flex items-center justify-center text-slate-300">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading LeadForge…</p>
        </div>
      </div>
    );
  }

  const displayName = staffSession.first_name
    ? `${staffSession.first_name} ${staffSession.last_name || ""}`.trim()
    : staffSession.name || staffSession.email;

  return (
    <div className="min-h-screen bg-[#080D18]">
      <div className="sticky top-0 z-[120] border-b border-white/10 bg-[#0E1627]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Access Your Place Back Office</p>
            <h1 className="truncate text-lg font-bold text-white">LeadForge Apollo CRM</h1>
            <p className="truncate text-xs text-slate-400">Signed in as {displayName}</p>
          </div>
          <Button asChild variant="outline" size="sm" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <Link to="/staff/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
      <LeadForge />
    </div>
  );
}
