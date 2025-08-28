import React, { useState, useEffect } from "react";
import {
  FaSignOutAlt,
  FaChevronRight,
  FaChevronDown,
  FaRegSquare, // ícono de fallback
} from "react-icons/fa";
import * as FaIcons from "react-icons/fa"; // import dinámico de todos los íconos
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

// Traductor de nombres (snake_case → Capitalizado)
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
  "/control-dsh/nuevo-registro":NuevoRegistro,
  "/control-dsh/historial":HistorialRecoleccion,
  "/configuracion/umbral-llenado":UmbralDeLlenado,
  "/configuracion/copia-seguridad" :Backup,
};

const Dashboard = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [expandedModule, setExpandedModule] = useState(null);

  //  Por defecto cargamos Inicio
  const [selectedSubmodule, setSelectedSubmodule] = useState({
    id: 0,
    nombre: "Inicio",
    ruta: "/dashboard",
    icono: "home",
  });

  const [userData, setUserData] = useState({ usuario: "", rol: "" });
  const navigate = useNavigate();

  //  Cargar menú dinámico desde backend
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
          `http://localhost:3001/api/menu/${decoded.rol_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMenuItems(res.data);

        //  Buscar Inicio en el menú de BD
        const inicioModulo = res.data.find((m) => m.ruta === "/dashboard");
        if (inicioModulo) {
          setSelectedSubmodule(inicioModulo); // lo selecciona automáticamente
        }
      } catch (err) {
        console.error("Error cargando menú:", err);
        toast.error("No se pudo cargar el menú");
      }
    };
    loadMenu();
  }, []);

  //  Verificación y expiración automática del token
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
      } else {
        handleLogout(true);
      }
    } catch {
      handleLogout(true);
    }
  }, []);

  //  Función para abrir/cerrar módulos
  const toggleModule = (id, hasSubmodules) => {
    if (!hasSubmodules) return;
    setExpandedModule(expandedModule === id ? null : id);
  };

  //  Función para cerrar sesión
  const handleLogout = (auto = false) => {
    localStorage.removeItem("token");
    if (auto) {
      toast.warning("Tu sesión ha caducado, vuelve a iniciar sesión ");
    } else {
      toast.success("Sesión cerrada correctamente ");
    }
    navigate("/");
  };

  //  Determinar componente a mostrar según la `ruta` del submódulo
  const SubmoduloComponent =
    selectedSubmodule && submoduloComponents[selectedSubmodule.ruta];

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">Menú</div>
        <ul>
          {menuItems.map((modulo) => {
            const hasSubmodules =
              Array.isArray(modulo.submodulos) && modulo.submodulos.length > 0;

            return (
              <li key={modulo.id}>
                <div
                  className={`menu-module ${expandedModule === modulo.id ? "active" : ""
                    }`}
                  onClick={() => {
                    //  Si es Inicio (sin submódulos), cargar directamente su vista
                    if (!hasSubmodules && modulo.ruta === "/dashboard") {
                      setSelectedSubmodule(modulo);
                    } else {
                      toggleModule(modulo.id, hasSubmodules);
                    }
                  }}
                >
                  <span style={{ marginRight: "6px" }}>
                    {getIcon(modulo.icono)}
                  </span>
                  <span>{formatoTitulo(modulo.nombre)}</span>

                  {hasSubmodules &&
                    (expandedModule === modulo.id ? (
                      <FaChevronDown className="arrow-icon" />
                    ) : (
                      <FaChevronRight className="arrow-icon" />
                    ))}
                </div>

                {expandedModule === modulo.id && hasSubmodules && (
                  <ul className="submenu">
                    {modulo.submodulos.map((sub) => (
                      <li
                        key={sub.id}
                        onClick={() => setSelectedSubmodule(sub)}
                      >
                        <span style={{ marginRight: "6px" }}>
                          {getIcon(sub.icono)}
                        </span>
                        {formatoTitulo(sub.nombre)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <nav className="navbar">
          <div className="bienvenida">
            <h2>Bienvenido al Sistema: {userData.rol}</h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
            <span style={{ fontWeight: "bold" }}>{userData.usuario}</span>
            <button className="btn-logout" onClick={() => handleLogout(false)}>
              <FaSignOutAlt /> Cerrar Sesión
            </button>
          </div>
        </nav>

        {/* Render dinámico de submódulos */}
        <div className="submodulo-wrapper">
          {SubmoduloComponent ? (
            <SubmoduloComponent />
          ) : (
            <h2>este modulo aun no tiene vista asignada...</h2>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
