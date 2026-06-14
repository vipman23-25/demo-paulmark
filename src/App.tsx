import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { lazy, Suspense, Component, ErrorInfo, ReactNode, useEffect } from "react";

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Bir Hata Oluştu</h1>
          <p className="text-muted-foreground mb-6">Uygulama yüklenirken bir sorunla karşılaşıldı. Lütfen sayfayı yenileyin.</p>
          <button 
            onClick={() => window.location.href = window.location.href.split('?')[0] + '?t=' + new Date().getTime()}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium"
          >
            Sayfayı Yenile
          </button>
          <pre className="mt-8 p-4 bg-muted text-xs text-left overflow-auto max-w-full rounded-md">
            {this.state.error?.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AntiCopyProtection } from "@/components/AntiCopyProtection";

// Custom lazy wrapper to handle chunk loading failures (especially for PWAs)
const retryLazy = (componentImport: () => Promise<any>) => {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      console.error("Chunk load error, forcing reload...", error);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
          window.location.href = window.location.href.split('?')[0] + '?t=' + new Date().getTime();
        }).catch(() => {
          window.location.href = window.location.href.split('?')[0] + '?t=' + new Date().getTime();
        });
      } else {
        window.location.href = window.location.href.split('?')[0] + '?t=' + new Date().getTime();
      }
      return { default: () => <div className="min-h-screen flex items-center justify-center">Sürüm güncelleniyor, lütfen bekleyin...</div> };
    }
  });
};

const Index = retryLazy(() => import("./pages/Index"));
const Login = retryLazy(() => import("./pages/Login"));
const EmployeePanel = retryLazy(() => import("./pages/EmployeePanel"));
const AdminLayout = retryLazy(() => import("./layouts/AdminLayout"));
const Dashboard = retryLazy(() => import("./pages/admin/Dashboard"));
const PersonnelManagement = retryLazy(() => import("./pages/admin/PersonnelManagement"));
const BreakTracking = retryLazy(() => import("./pages/admin/BreakTracking"));
const BreakPlanning = retryLazy(() => import("./pages/admin/BreakPlanning"));
const MovementManagement = retryLazy(() => import("./pages/admin/MovementManagement"));
const DayOffView = retryLazy(() => import("./pages/admin/DayOffView"));
const OvertimeManagement = retryLazy(() => import("./pages/admin/OvertimeManagement"));
const ReminderManagement = retryLazy(() => import("./pages/admin/ReminderManagement"));
const SystemSettingsView = retryLazy(() => import("./pages/admin/SystemSettings"));
const NotificationSettings = retryLazy(() => import("./pages/admin/NotificationSettings"));
const SalesTargets = retryLazy(() => import("./pages/admin/SalesTargets"));
const CargoManagement = retryLazy(() => import("./pages/admin/CargoManagement"));
const LogisticsTracking = retryLazy(() => import("./pages/admin/LogisticsTracking"));
const ShiftManagement = retryLazy(() => import("./pages/admin/ShiftManagement"));
const SystemLogs = retryLazy(() => import("./pages/admin/SystemLogs").then(m => ({ default: m.SystemLogs })));
const NotFound = retryLazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: true, // Her zaman sekme odaklandığında güncel veriyi çeksin
      staleTime: 1000 * 60 * 1, // 1 dakika boyunca veriyi taze kabul et (spam'i engelle)
      gcTime: 1000 * 60 * 5, // 5 dakika
    },
  },
});

const LocationRequest = () => {
  useEffect(() => {
    // Request location permission on app startup
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => { console.log("Location permission granted on startup."); },
        (err) => { console.warn("Location permission not granted:", err); },
        { enableHighAccuracy: true }
      );
    }
  }, []);
  return null;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LocationRequest />
        <Toaster />
        <Sonner />
        <PWAInstallPrompt />
        <BrowserRouter>
          <AuthProvider>
            <AntiCopyProtection />
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground animate-pulse">Sayfa Yükleniyor...</div>}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                
                {/* Sadece giriş yapmış kullanıcılar (Personel veya Admin) */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/employee" element={<EmployeePanel />} />
                </Route>

                {/* Sadece Admin yetkisi olanlar */}
                <Route element={<ProtectedRoute requireAdmin />}>
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="personnel" element={<PersonnelManagement />} />
                    <Route path="breaks" element={<BreakTracking />} />
                    <Route path="break-planning" element={<BreakPlanning />} />
                    <Route path="movements" element={<MovementManagement />} />
                    <Route path="day-off" element={<DayOffView />} />
                    <Route path="overtime" element={<OvertimeManagement />} />
                    <Route path="shifts" element={<ShiftManagement />} />
                    <Route path="cargo" element={<CargoManagement />} />
                    <Route path="logistics" element={<LogisticsTracking />} />
                    <Route path="reminders" element={<ReminderManagement />} />
                    <Route path="sales-targets" element={<SalesTargets />} />
                    <Route path="notifications" element={<NotificationSettings />} />
                    <Route path="settings" element={<SystemSettingsView />} />
                    <Route path="system-logs" element={<SystemLogs />} />
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
