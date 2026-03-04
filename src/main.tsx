import { StrictMode } from 'react';
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import App from "./App.tsx";
import Auth from "./pages/Auth";
import StudentAuth from "./pages/StudentAuth";
import ResetPassword from "./pages/ResetPassword";
import ScanAttendance from "./pages/ScanAttendance";
import MarkAttendance from "./pages/MarkAttendance";
import PrintAttendanceQr from "./pages/PrintAttendanceQr";
import NotFound from "./pages/NotFound";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/student-auth" element={<StudentAuth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/scan/:sessionId" element={<ScanAttendance />} />
            <Route path="/mark-attendance" element={<MarkAttendance />} />
            <Route path="/print-qr" element={<PrintAttendanceQr />} />
            <Route path="/" element={<App />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>
);
