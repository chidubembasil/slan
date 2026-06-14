import { useEffect } from "react";

export function useAuthGuard() {
  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem("adminAccessToken");
      const expiry = localStorage.getItem("adminTokenExpiry");

      if (!token || !expiry || Date.now() >= Number(expiry)) {
        localStorage.removeItem("adminAccessToken");
        localStorage.removeItem("adminRefreshToken");
        localStorage.removeItem("adminUser");
        localStorage.removeItem("adminTokenExpiry");
        window.location.href = "/";
      }
    };

    check();
    const interval = setInterval(check, 30 * 1000);
    return () => clearInterval(interval);
  }, []);
}