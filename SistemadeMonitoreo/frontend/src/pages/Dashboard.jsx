import React, { useState, useEffect } from "react";
import {
  FaSignOutAlt,
  FaChevronRight,
  FaChevronDown,
  FaRegSquare,
  FaBars,
  FaTimes,
} from "react-icons/fa";
import * as FaIcons from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import axios from "axios";
import "../styles/dashboard.css";


// Importar vistas
import MiPerfil from "./Perfil/MiPerfil";
import AgregarContenedor from "./contenedor/AgregarContenedor";
import Inicio from "./Perfil/Inicio";
import NuevoRegistro from "./controlDSH/NuevoRegistro";
import HistorialRecoleccion from "./historialRecoleccion/HistorialRecoleccion";
import UmbralDeLlenado from "./umbrales/UmbralDeLlenado";
import Backup from "./backups/Backup";
import HistorialCosto from "./historialcosto/HistorialCosto";
import HistorialGrafica from "./controlDSH/HistorialGrafica";

/**
 * =====================================================
 * CONFIGURACIÓN DE ENTORNO
 * =====================================================
 *
 * La URL del backend se define en:
 * VITE_API_URL
 *
 * El valor cambia según el entorno
 * sin modificar este archivo.
 */
const API_URL = import.meta.env.VITE_API_URL;

// Función para obtener ícono dinámicamente desde la BD
const getIcon = (iconName) => {
  if (!iconName) return <FaRegSquare />;

  const formatted =
    "Fa" +
    iconName
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");

  const IconComponent = FaIcons[formatted];

  return IconComponent ? <IconComponent /> : <FaRegSquare />;
};

// Traductor de nombres
const formatoTitulo = (texto) => {
  if (!texto) return "";

  return texto
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (w) =>
      w.charAt(0).toUpperCase() + w.substr(1).toLowerCase()
    );
};

// Mapeo de submódulos a componentes reales
const submoduloComponents = {
  "/usuarios/editar": MiPerfil,
  "/contenedor/agregar": AgregarContenedor,
  "/dashboard": Inicio,
  "/control-dsh/nuevo-registro": NuevoRegistro,
  "/control-dsh/historial": HistorialRecoleccion,
  "/configuracion/umbral-llenado": UmbralDeLlenado,
  "/configuracion/copia-seguridad": Backup,
  "/costo/historial": HistorialCosto,
  "/control-dsh/historial-graficas": HistorialGrafica,
};

const Dashboard = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [expandedModule, setExpandedModule] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Por defecto cargamos Inicio
  const [selectedSubmodule, setSelectedSubmodule] = useState({
    id: 0,
    nombre: "Inicio",
    ruta: "/dashboard",
    icono: "home",
  });

  const [userData, setUserData] = useState({
    usuario: "",
    rol: "",
  });

  const navigate = useNavigate();

  /**
   * =====================================================
   * CARGAR MENÚ DINÁMICO
   * =====================================================
   */
  useEffect(() => {
    const loadMenu = async () => {
      const token = localStorage.getItem("token");

      if (!token) return;

      try {
        const decoded = jwtDecode(token);

        setUserData({
          usuario: decoded.usuario || "usuario",
          rol: decoded.rol || "Rol",
        });

        const res = await axios.get(
          `${API_URL}/api/menu/${decoded.rol_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setMenuItems(res.data);

        // Buscar Inicio en el menú de BD
        const inicioModulo = res.data.find(
          (modulo) => modulo.ruta === "/dashboard"
        );

        if (inicioModulo) {
          setSelectedSubmodule(inicioModulo);
        }
      } catch (err) {
        console.error("Error cargando menú:", err);
        toast.error("No se pudo cargar el menú");
      }
    };

    loadMenu();
  }, []);

  /**
   * =====================================================
   * EXPIRACIÓN AUTOMÁTICA DEL TOKEN
   * =====================================================
   */
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) return;

    try {
      const decoded = jwtDecode(token);
      const now = Date.now() / 1000;

      if (decoded.exp > now) {
        const timeLeft = (decoded.exp - now) * 1000;

        const timer = setTimeout(() => {
          handleLogout(true);
        }, timeLeft);

        return () => clearTimeout(timer);
      }

      handleLogout(true);
    } catch {
      handleLogout(true);
    }
  }, []);

  /**
   * =====================================================
   * CERRAR MENÚ MÓVIL CON ESC
   * =====================================================
   */
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  /**
   * =====================================================
   * ABRIR / CERRAR MÓDULOS
   * =====================================================
   */
  const toggleModule = (id, hasSubmodules) => {
    if (!hasSubmodules) return;

    setExpandedModule(
      expandedModule === id ? null : id
    );
  };

  /**
   * =====================================================
   * CERRAR SESIÓN
   * =====================================================
   */
  const handleLogout = async (auto = false) => {
    const token = localStorage.getItem("token");

    if (token) {
      try {
        await axios.post(
          `${API_URL}/api/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } catch (err) {
        console.error(
          "Error al cerrar sesión en backend:",
          err
        );

        // Aunque falle backend,
        // frontend debe cerrar la sesión.
      }
    }

    localStorage.removeItem("token");

    if (auto) {
      toast.warning(
        "Tu sesión ha caducado, vuelve a iniciar sesión"
      );
    } else {
      toast.success(
        "Sesión cerrada correctamente"
      );
    }

    navigate("/");
  };

  /**
   * =====================================================
   * COMPONENTE SELECCIONADO
   * =====================================================
   */
  const SubmoduloComponent =
    selectedSubmodule &&
    submoduloComponents[selectedSubmodule.ruta];

  return (
    <div className="dashboard-container">

      {/* ==================================================
          OVERLAY MÓVIL
      ================================================== */}
      {mobileMenuOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ==================================================
          SIDEBAR
      ================================================== */}
      <aside
        className={`sidebar ${mobileMenuOpen ? "open" : ""}`}
        aria-label="Menú principal"
      >
        <div className="sidebar-header">
          <span>Menú</span>

          <button
            type="button"
            className="sidebar-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <FaTimes />
          </button>
        </div>

        <ul className="sidebar-menu">
          {menuItems.map((modulo) => {
            const hasSubmodules =
              Array.isArray(modulo.submodulos) &&
              modulo.submodulos.length > 0;

            const isExpanded =
              expandedModule === modulo.id;

            return (
              <li
                key={modulo.id}
                className="sidebar-menu-item"
              >
                <div
                  className={`menu-module ${
                    isExpanded ? "active" : ""
                  }`}
                  onClick={() => {
                    if (
                      !hasSubmodules &&
                      modulo.ruta === "/dashboard"
                    ) {
                      setSelectedSubmodule(modulo);
                      setMobileMenuOpen(false);
                    } else {
                      toggleModule(
                        modulo.id,
                        hasSubmodules
                      );
                    }
                  }}
                >
                  <span className="menu-icon">
                    {getIcon(modulo.icono)}
                  </span>

                  <span className="menu-label">
                    {formatoTitulo(modulo.nombre)}
                  </span>

                  {hasSubmodules && (
                    <span className="menu-arrow">
                      {isExpanded ? (
                        <FaChevronDown />
                      ) : (
                        <FaChevronRight />
                      )}
                    </span>
                  )}
                </div>

                {isExpanded && hasSubmodules && (
                  <ul className="submenu">
                    {modulo.submodulos.map((sub) => {
                      const isSelected =
                        selectedSubmodule?.id === sub.id;

                      return (
                        <li
                          key={sub.id}
                          className={
                            isSelected ? "active" : ""
                          }
                          onClick={() => {
                            setSelectedSubmodule(sub);
                            setMobileMenuOpen(false);
                          }}
                        >
                          <span className="submenu-icon">
                            {getIcon(sub.icono)}
                          </span>

                          <span className="submenu-label">
                            {formatoTitulo(sub.nombre)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ==================================================
          CONTENIDO PRINCIPAL
      ================================================== */}
      <main className="main-content">

        {/* Navbar */}
        <nav className="navbar">
          <button
            type="button"
            className="mobile-menu-button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <FaBars />
          </button>

          <div className="bienvenida">
            <h2>
              Bienvenido al Sistema:
              <span className="navbar-role">
                {" "}
                {userData.rol}
              </span>
            </h2>
          </div>

          <div className="navbar-actions">
            <span className="user-name">
              {userData.usuario}
            </span>

            <button
              type="button"
              className="app-btn app-btn-danger btn-logout"
              onClick={() => handleLogout(false)}
            >
              <FaSignOutAlt />

              <span>
                Cerrar Sesión
              </span>
            </button>
          </div>
        </nav>

        {/* Render dinámico de submódulos */}
        <div className="submodulo-wrapper">
          {SubmoduloComponent ? (
            <SubmoduloComponent />
          ) : (
            <div className="empty-module">
              <h2>
                Este módulo aún no tiene una vista asignada
              </h2>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
