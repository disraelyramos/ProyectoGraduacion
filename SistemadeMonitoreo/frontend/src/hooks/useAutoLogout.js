import { useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const useAutoLogout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const decoded = jwtDecode(token);
      const now = Date.now() / 1000;

      if (decoded.exp > now) {
        const timeLeft = (decoded.exp - now) * 1000;

        // 🔹 Programar auto-logout al expirar el token
        const timer = setTimeout(() => {
          localStorage.removeItem("token");
          toast.warning("Tu sesión ha caducado, vuelve a iniciar sesión 🔒");
          navigate("/", { replace: true });
        }, timeLeft);

        return () => clearTimeout(timer); // limpiar si se desmonta
      } else {
        // Token ya vencido → cerrar sesión inmediato
        localStorage.removeItem("token");
        navigate("/", { replace: true });
      }
    } catch (err) {
      localStorage.removeItem("token");
      navigate("/", { replace: true });
    }
  }, [navigate]);
};

export default useAutoLogout;
