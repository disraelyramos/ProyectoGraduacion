import React, {

  useEffect,

  useState,

} from "react";

import {

  FaSignOutAlt,

  FaChevronRight,

  FaChevronDown,

  FaRegSquare,

  FaBars,

  FaTimes,

} from "react-icons/fa";

import * as FaIcons

  from "react-icons/fa";

import {

  useNavigate,

} from "react-router-dom";

import {

  jwtDecode,

} from "jwt-decode";

import axios

  from "axios";

import "../styles/dashboard.css";

import {

  showBackendAlert,

  showSessionExpiredAlert,

  showSuccessAlert,

  showConfirmAlert,

} from "../utils/alerts";

// =========================================================

// VISTAS

// =========================================================

import MiPerfil

  from "./Perfil/MiPerfil";

import AgregarContenedor

  from "./contenedor/AgregarContenedor";

import Inicio

  from "./Perfil/Inicio";

import NuevoRegistro

  from "./controlDSH/NuevoRegistro";

import HistorialRecoleccion

  from "./historialRecoleccion/HistorialRecoleccion";

import UmbralDeLlenado

  from "./umbrales/UmbralDeLlenado";

import Backup

  from "./backups/Backup";

import HistorialCosto

  from "./historialcosto/HistorialCosto";

import HistorialGrafica

  from "./controlDSH/HistorialGrafica";

/* =========================================================

   CONFIGURACIÓN DE ENTORNO

   FRONTEND .env:

   VITE_API_URL=http\://localhost:3001

   En producción solamente cambia el valor del .env.

   ========================================================= */

const API_URL =

  import.meta.env.VITE_API_URL;

/* =========================================================

   OBTENER ÍCONO DINÁMICO

   ========================================================= */

const getIcon =

  (

    iconName

  ) => {

    if (!iconName) {

      return (

        <FaRegSquare />

      );

    }

    const formatted =

      "Fa" +

      iconName

        .split("-")

        .map(

          (word) =>

            word

              .charAt(0)

              .toUpperCase() +

            word

              .slice(1)

        )

        .join("");

    const IconComponent =

      FaIcons[

        formatted

      ];

    return IconComponent

      ? (

          <IconComponent />

        )

      : (

          <FaRegSquare />

        );

  };

/* =========================================================

   FORMATEAR TÍTULOS

   ========================================================= */

const formatoTitulo =

  (

    texto

  ) => {

    if (!texto) {

      return "";

    }

    return texto

      .replace(

        /_/g,

        " "

      )

      .replace(

        /\w\S*/g,

        (word) =>

          word

            .charAt(0)

            .toUpperCase() +

          word

            .slice(1)

            .toLowerCase()

      );

  };

/* =========================================================

   SUBMÓDULOS

   ========================================================= */

const submoduloComponents = {

  "/usuarios/editar":

    MiPerfil,

  "/contenedor/agregar":

    AgregarContenedor,

  "/dashboard":

    Inicio,

  "/control-dsh/nuevo-registro":

    NuevoRegistro,

  "/control-dsh/historial":

    HistorialRecoleccion,

  "/configuracion/umbral-llenado":

    UmbralDeLlenado,

  "/configuracion/copia-seguridad":

    Backup,

  "/costo/historial":

    HistorialCosto,

  "/control-dsh/historial-graficas":

    HistorialGrafica,

};

/* =========================================================

   COMPONENTE

   ========================================================= */

const Dashboard = () => {

  /* =======================================================

     MENÚ

     ======================================================= */

  const [

    menuItems,

    setMenuItems,

  ] =

    useState([]);

  const [

    expandedModule,

    setExpandedModule,

  ] =

    useState(null);

  const [

    mobileMenuOpen,

    setMobileMenuOpen,

  ] =

    useState(false);

  /* =======================================================

     SUBMÓDULO ACTUAL

     ======================================================= */

  const [

    selectedSubmodule,

    setSelectedSubmodule,

  ] =

    useState({

      id: 0,

      nombre: "Inicio",

      ruta: "/dashboard",

      icono: "home",

    });

  /* =======================================================

     INFORMACIÓN VISUAL DEL USUARIO

     ======================================================= */

  const [

    userData,

    setUserData,

  ] =

    useState({

      usuario: "",

      rol: "",

    });

  /* =======================================================

     EVITAR DOBLE LOGOUT

     ======================================================= */

  const [

    logoutLoading,

    setLogoutLoading,

  ] =

    useState(false);

  const navigate =

    useNavigate();

  /* =========================================================

     CARGAR MENÚ DINÁMICO

     ========================================================= */

  useEffect(

    () => {

      let componenteActivo =

        true;

      const loadMenu =

        async () => {

          const token =

            localStorage.getItem(

              "token"

            );

          /* ===============================================

             TOKEN INEXISTENTE

             =============================================== */

          if (!token) {

            await showSessionExpiredAlert();

            return;

          }

          let decoded;

          /* ===============================================

             VALIDAR JWT

             =============================================== */

          try {

            decoded =

              jwtDecode(

                token

              );

          } catch (

            error

          ) {

            console.error(

              "Token inválido:",

              error

            );

            await showSessionExpiredAlert();

            return;

          }

          /* ===============================================

             VALIDAR EXPIRACIÓN

             =============================================== */

          const now =

            Date.now() /

            1000;

          if (

            !decoded?.exp ||

            decoded.exp <= now

          ) {

            await showSessionExpiredAlert();

            return;

          }

          if (

            !componenteActivo

          ) {

            return;

          }

          /* ===============================================

             DATOS VISUALES DEL USUARIO

             Estos datos solamente se muestran.

             El backend NO debe confiar en ellos para

             identificar al usuario.

             =============================================== */

          setUserData({

            usuario:

              decoded.usuario ||

              "usuario",

            rol:

              decoded.rol ||

              "Rol",

          });

          /* ===============================================

             CARGAR MENÚ

             =============================================== */

          try {

            const res =

              await axios.get(

                `${API_URL}/api/menu/${decoded.rol_id}`,

                {

                  headers: {

                    Authorization:

                      `Bearer ${token}`,

                  },

                }

              );

            if (

              !componenteActivo

            ) {

              return;

            }

            const menu =

              Array.isArray(

                res.data

              )

                ? res.data

                : [];

            setMenuItems(

              menu

            );

            /* =============================================

               BUSCAR INICIO

               ============================================= */

            const inicioModulo =

              menu.find(

                (modulo) =>

                  modulo.ruta ===

                  "/dashboard"

              );

            if (

              inicioModulo

            ) {

              setSelectedSubmodule(

                inicioModulo

              );

            }

          } catch (

            error

          ) {

            console.error(

              "Error cargando menú:",

              error

            );

            const status =

              Number(

                error

                  ?.response

                  ?.status

              ) || 500;

            /* =============================================

               SESIÓN CADUCADA

               ============================================= */

            if (

              status === 401

            ) {

              await showSessionExpiredAlert();

              return;

            }

            /* =============================================

               OTRO ERROR BACKEND

               ============================================= */

            await showBackendAlert({

              status,

              data:

                error

                  ?.response

                  ?.data &&

                typeof error

                  .response

                  .data ===

                  "object"

                  ? error

                      .response

                      .data

                  : {

                      message:

                        "No fue posible cargar el menú.",

                    },

            });

          }

        };

      loadMenu();

      return () => {

        componenteActivo =

          false;

      };

    },

    []

  );

  /* =========================================================

     EXPIRACIÓN AUTOMÁTICA DEL TOKEN

     ========================================================= */

  useEffect(

    () => {

      const token =

        localStorage.getItem(

          "token"

        );

      if (!token) {

        return;

      }

      let decoded;

      try {

        decoded =

          jwtDecode(

            token

          );

      } catch (

        error

      ) {

        console.error(

          "Token inválido:",

          error

        );

        showSessionExpiredAlert();

        return;

      }

      const exp =

        Number(

          decoded?.exp

        );

      if (

        !Number.isFinite(

          exp

        )

      ) {

        showSessionExpiredAlert();

        return;

      }

      const expirationTime =

        exp *

        1000;

      const timeLeft =

        expirationTime -

        Date.now();

      /* ===============================================

         YA ESTÁ VENCIDO

         =============================================== */

      if (

        timeLeft <= 0

      ) {

        showSessionExpiredAlert();

        return;

      }

      /* ===============================================

         PROGRAMAR ALERTA

         =============================================== */

      const timer =

        window.setTimeout(

          () => {

            showSessionExpiredAlert();

          },

          timeLeft

        );

      return () => {

        window.clearTimeout(

          timer

        );

      };

    },

    []

  );

  /* =========================================================

     CERRAR MENÚ MÓVIL CON ESC

     ========================================================= */

  useEffect(

    () => {

      if (

        !mobileMenuOpen

      ) {

        return;

      }

      const handleKeyDown =

        (

          event

        ) => {

          if (

            event.key ===

            "Escape"

          ) {

            setMobileMenuOpen(

              false

            );

          }

        };

      window.addEventListener(

        "keydown",

        handleKeyDown

      );

      return () => {

        window.removeEventListener(

          "keydown",

          handleKeyDown

        );

      };

    },

    [

      mobileMenuOpen,

    ]

  );

  /* =========================================================

     ABRIR / CERRAR MÓDULO

     ========================================================= */

  const toggleModule =

    (

      id,

      hasSubmodules

    ) => {

      if (

        !hasSubmodules

      ) {

        return;

      }

      setExpandedModule(

        expandedModule === id

          ? null

          : id

      );

    };

  const handleLogout =

    async () => {

      /* ===============================================

         EVITAR DOBLE CLIC

         =============================================== */

      if (

        logoutLoading

      ) {

        return;

      }

      const token =

        localStorage.getItem(

          "token"

        );

      /* ===============================================

         YA NO EXISTE SESIÓN

         =============================================== */

      if (!token) {

        await showSessionExpiredAlert();

        return;

      }

      /* ===============================================

         PREGUNTAR ANTES DE CERRAR

         =============================================== */

      await showConfirmAlert(

        "¿Desea cerrar sesión?",

        "Deberá iniciar sesión nuevamente para continuar.",

        /* =============================================

           USUARIO CONFIRMÓ

           ============================================= */

        async () => {

          if (

            logoutLoading

          ) {

            return;

          }

          setLogoutLoading(

            true

          );

          try {

            /* =========================================

               CERRAR SESIÓN EN BACKEND

               ========================================= */

            try {

              await axios.post(

                `${API_URL}/api/auth/logout`,

                {},

                {

                  headers: {

                    Authorization:

                      `Bearer ${token}`,

                  },

                }

              );

            } catch (

              error

            ) {

              console.error(

                "Error al cerrar sesión en backend:",

                error

              );

              const status =

                Number(

                  error

                    ?.response

                    ?.status

                );

              /* =======================================

                 SESIÓN YA CADUCADA

                 ======================================= */

              if (

                status === 401

              ) {

                await showSessionExpiredAlert();

                return;

              }

              /*

               * Si ocurre otro error de red o servidor,

               * se cierra igualmente la sesión local.

               *

               * El usuario no debe quedar atrapado

               * dentro del sistema por un fallo del

               * endpoint de logout.

               */

            }

            /* =========================================

               LIMPIAR SESIÓN LOCAL

               ========================================= */

            localStorage.removeItem(

              "token"

            );

            /* =========================================

               CONFIRMAR CIERRE

               ========================================= */

            await showSuccessAlert(

              "Sesión cerrada correctamente"

            );

            /* =========================================

               IR AL LOGIN

               ========================================= */

            navigate(

              "/",

              {

                replace:

                  true,

              }

            );

          } finally {

            setLogoutLoading(

              false

            );

          }

        },

        /* =============================================

           CANCELAR

           No hace nada.

           ============================================= */

        null

      );

    };

  /* =========================================================

     COMPONENTE ACTUAL

     ========================================================= */

  // Navegación interna: conserva el menú y la vista del sistema.
  // Solo abre submódulos presentes en el menú recibido del backend.
  const abrirSubmodulo = (ruta) => {
    const submodulo = menuItems
      .flatMap((modulo) => [
        modulo,
        ...(Array.isArray(modulo.submodulos) ? modulo.submodulos : []),
      ])
      .find((item) => item.ruta === ruta);

    if (!submodulo || !submoduloComponents[ruta]) {
      console.error("Submódulo no disponible:", ruta);
      return;
    }

    setSelectedSubmodule(submodulo);
    setMobileMenuOpen(false);
  };

  const SubmoduloComponent =

    selectedSubmodule &&

    submoduloComponents[

      selectedSubmodule.ruta

    ];

  /* =========================================================

     VISTA

     ========================================================= */

  return (

    <div className="dashboard-container">

      {/* ==================================================

          OVERLAY MÓVIL

      ================================================== */}

      {mobileMenuOpen && (

        <div

          className="sidebar-overlay"

          onClick={

            () =>

              setMobileMenuOpen(

                false

              )

          }

          aria-hidden="true"

        />

      )}

      {/* ==================================================

          SIDEBAR

      ================================================== */}

      <aside

        className={

          `sidebar ${

            mobileMenuOpen

              ? "open"

              : ""

          }`

        }

        aria-label="Menú principal"

      >

        {/* ================================================

            HEADER SIDEBAR

        ================================================ */}

        <div className="sidebar-header">

          <span>

            Menú

          </span>

          <button

            type="button"

            className="sidebar-close"

            onClick={

              () =>

                setMobileMenuOpen(

                  false

                )

            }

            aria-label="Cerrar menú"

          >

            <FaTimes />

          </button>

        </div>

        {/* ================================================

            MENÚ

        ================================================ */}

        <ul className="sidebar-menu">

          {menuItems.map(

            (

              modulo

            ) => {

              const hasSubmodules =

                Array.isArray(

                  modulo.submodulos

                ) &&

                modulo

                  .submodulos

                  .length >

                  0;

              const isExpanded =

                expandedModule ===

                modulo.id;

              return (

                <li

                  key={

                    modulo.id

                  }

                  className="sidebar-menu-item"

                >

                  {/* =======================================

                      MÓDULO PRINCIPAL

                  ======================================= */}

                  <div

                    className={

                      `menu-module ${

                        isExpanded

                          ? "active"

                          : ""

                      }`

                    }

                    onClick={

                      () => {

                        if (

                          !hasSubmodules &&

                          modulo.ruta ===

                            "/dashboard"

                        ) {

                          setSelectedSubmodule(

                            modulo

                          );

                          setMobileMenuOpen(

                            false

                          );

                        } else {

                          toggleModule(

                            modulo.id,

                            hasSubmodules

                          );

                        }

                      }

                    }

                  >

                    <span className="menu-icon">

                      {getIcon(

                        modulo.icono

                      )}

                    </span>

                    <span className="menu-label">

                      {formatoTitulo(

                        modulo.nombre

                      )}

                    </span>

                    {hasSubmodules && (

                      <span className="menu-arrow">

                        {isExpanded

                          ? (

                              <FaChevronDown />

                            )

                          : (

                              <FaChevronRight />

                            )

                        }

                      </span>

                    )}

                  </div>

                  {/* =======================================

                      SUBMÓDULOS

                  ======================================= */}

                  {isExpanded &&

                    hasSubmodules && (

                    <ul className="submenu">

                      {modulo

                        .submodulos

                        .map(

                          (

                            sub

                          ) => {

                            const isSelected =

                              selectedSubmodule

                                ?.id ===

                              sub.id;

                            return (

                              <li

                                key={

                                  sub.id

                                }

                                className={

                                  isSelected

                                    ? "active"

                                    : ""

                                }

                                onClick={

                                  () => {

                                    setSelectedSubmodule(

                                      sub

                                    );

                                    setMobileMenuOpen(

                                      false

                                    );

                                  }

                                }

                              >

                                <span className="submenu-icon">

                                  {getIcon(

                                    sub.icono

                                  )}

                                </span>

                                <span className="submenu-label">

                                  {formatoTitulo(

                                    sub.nombre

                                  )}

                                </span>

                              </li>

                            );

                          }

                        )}

                    </ul>

                  )}

                </li>

              );

            }

          )}

        </ul>

      </aside>

      {/* ==================================================

          CONTENIDO PRINCIPAL

      ================================================== */}

      <main className="main-content">

        {/* =================================================

            NAVBAR

        ================================================= */}

        <nav className="navbar">

          {/* ===============================================

              MENÚ MÓVIL

          =============================================== */}

          <button

            type="button"

            className="mobile-menu-button"

            onClick={

              () =>

                setMobileMenuOpen(

                  true

                )

            }

            aria-label="Abrir menú"

          >

            <FaBars />

          </button>

          {/* ===============================================

              BIENVENIDA

          =============================================== */}

          <div className="bienvenida">

            <h2>

              Bienvenido al Sistema:

              <span className="navbar-role">

                {" "}

                {userData.rol}

              </span>

            </h2>

          </div>

          {/* ===============================================

              ACCIONES

          =============================================== */}

          <div className="navbar-actions">

            <span className="user-name">

              {userData.usuario}

            </span>

            <button

              type="button"

              className="app-btn app-btn-danger btn-logout"

              onClick={

                handleLogout

              }

              disabled={

                logoutLoading

              }

            >

              <FaSignOutAlt />

              <span>

                {logoutLoading

                  ? "Cerrando..."

                  : "Cerrar Sesión"

                }

              </span>

            </button>

          </div>

        </nav>

        {/* =================================================

            SUBMÓDULO

        ================================================= */}

        <div className="submodulo-wrapper">

          {SubmoduloComponent

            ? (

                <SubmoduloComponent onNavigate={abrirSubmodulo} />

              )

            : (

                <div className="empty-module">

                  <h2>

                    Este módulo aún no tiene una vista asignada

                  </h2>

                </div>

              )

          }

        </div>

      </main>

    </div>

  );

};

export default Dashboard;