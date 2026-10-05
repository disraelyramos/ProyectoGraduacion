import React, {
  useEffect,
  useState,
} from "react";

import axios from "axios";

import {
  FaUsers,
  FaCube,
  FaPlus,
} from "react-icons/fa";

import ModalBase from "../../components/modals/ModalBase";

import GestionarUsuarios from "./GestionarUsuarios";
import GestionarModulos from "./GestionarModulos";

import {
  showBackendAlert,
  showSessionExpiredAlert,
  showSuccessAlert,
  showConfirmAlert,
} from "../../utils/alerts";

import "../../styles/administracion.css";


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const API_URL =
  import.meta.env.VITE_API_URL;


/* =========================================================
   COMPONENTE
   ========================================================= */

const CrearNuevoUsuario = () => {

  /* =======================================================
     MODAL NUEVO USUARIO
     ======================================================= */

  const [
    isUserModalOpen,
    setIsUserModalOpen,
  ] = useState(false);


  /* =======================================================
     VISTA DE ADMINISTRACIÓN
     ======================================================= */

  const [
    vistaAdministracion,
    setVistaAdministracion,
  ] = useState("inicio");


  /* =======================================================
     CATÁLOGOS
     ======================================================= */

  const [
    roles,
    setRoles,
  ] = useState([]);

  const [
    estadosUsuario,
    setEstadosUsuario,
  ] = useState([]);

  const [
    loadingCatalogos,
    setLoadingCatalogos,
  ] = useState(false);


  /* =======================================================
     GUARDANDO USUARIO
     ======================================================= */

  const [
    guardandoUsuario,
    setGuardandoUsuario,
  ] = useState(false);


  /* =======================================================
     ABRIR / CERRAR MODAL
     ======================================================= */

  const openUserModal = () => {

    setIsUserModalOpen(
      true
    );
  };


  const closeUserModal = () => {

    if (guardandoUsuario) {
      return;
    }


    setIsUserModalOpen(
      false
    );
  };


  /* =======================================================
     NAVEGACIÓN INTERNA
     ======================================================= */

  const abrirGestionUsuarios = () => {

    setVistaAdministracion(
      "usuarios"
    );
  };


  const abrirGestionModulos = () => {

    setVistaAdministracion(
      "modulos"
    );
  };


  const volverAdministracion = () => {

    setVistaAdministracion(
      "inicio"
    );
  };


  /* =======================================================
     CARGAR CATÁLOGOS
     ======================================================= */

  useEffect(() => {

    if (!isUserModalOpen) {
      return;
    }


    let componenteActivo =
      true;


    const cargarCatalogos =
      async () => {

        const token =
          localStorage.getItem(
            "token"
          );


        if (!token) {

          await showSessionExpiredAlert();

          return;
        }


        setLoadingCatalogos(
          true
        );


        try {

          const response =
            await axios.get(
              `${API_URL}/api/administracion/catalogos`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );


          if (!componenteActivo) {
            return;
          }


          const rolesRecibidos =
            Array.isArray(
              response.data?.roles
            )
              ? response.data.roles
              : [];


          const estadosRecibidos =
            Array.isArray(
              response.data
                ?.estadosUsuario
            )
              ? response.data
                  .estadosUsuario
              : [];


          setRoles(
            rolesRecibidos
          );


          setEstadosUsuario(
            estadosRecibidos
          );


        } catch (error) {

          if (!componenteActivo) {
            return;
          }


          const status =
            Number(
              error
                ?.response
                ?.status
            ) || 500;


          if (status === 401) {

            await showSessionExpiredAlert();

            return;
          }


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
                      "No fue posible cargar los datos del formulario.",
                  },
          });


        } finally {

          if (componenteActivo) {

            setLoadingCatalogos(
              false
            );
          }
        }
      };


    cargarCatalogos();


    return () => {

      componenteActivo =
        false;
    };

  }, [isUserModalOpen]);


  /* =======================================================
     CREAR USUARIO
     ======================================================= */

  const handleSubmit =
    async (event) => {

      event.preventDefault();


      if (guardandoUsuario) {
        return;
      }


      const form =
        event.currentTarget;


      const formData =
        new FormData(
          form
        );


      const datos = {

        nombre:
          String(
            formData.get(
              "nombre"
            ) || ""
          ).trim(),

        correo:
          String(
            formData.get(
              "correo"
            ) || ""
          ).trim(),

        usuario:
          String(
            formData.get(
              "usuario"
            ) || ""
          ).trim(),

        rol_id:
          Number(
            formData.get(
              "rol_id"
            )
          ),

        estado_id:
          Number(
            formData.get(
              "estado_id"
            )
          ),
      };


      /*
       * Validación visual.
       *
       * El backend vuelve a validar todo.
       */

      if (
        !datos.nombre ||
        !datos.correo ||
        !datos.usuario ||
        !Number.isSafeInteger(
          datos.rol_id
        ) ||
        datos.rol_id <= 0 ||
        !Number.isSafeInteger(
          datos.estado_id
        ) ||
        datos.estado_id <= 0
      ) {

        await showBackendAlert({
          status: 400,

          data: {
            message:
              "Complete correctamente todos los campos obligatorios.",
          },
        });


        return;
      }


      /* ===================================================
         CONFIRMACIÓN
         =================================================== */

      await showConfirmAlert(
        "¿Desea crear este usuario?",

        `Se enviarán las credenciales temporales al correo ${datos.correo}.`,

        async () => {

          const token =
            localStorage.getItem(
              "token"
            );


          if (!token) {

            await showSessionExpiredAlert();

            return;
          }


          setGuardandoUsuario(
            true
          );


          try {

            const response =
              await axios.post(
                `${API_URL}/api/administracion/usuarios`,
                datos,
                {
                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },
                }
              );


            const mensaje =
              response.data?.message ||
              "Usuario creado correctamente. Las credenciales temporales fueron enviadas por correo.";


            await showSuccessAlert(
              mensaje
            );


            form.reset();


            setIsUserModalOpen(
              false
            );


          } catch (error) {

            const status =
              Number(
                error
                  ?.response
                  ?.status
              ) || 500;


            if (status === 401) {

              await showSessionExpiredAlert();

              return;
            }


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
                        "No fue posible crear el usuario.",
                    },
            });


          } finally {

            setGuardandoUsuario(
              false
            );
          }
        },

        null
      );
    };


  /* =======================================================
     VISTA GESTIONAR USUARIOS
     ======================================================= */

  if (
    vistaAdministracion ===
    "usuarios"
  ) {

    return (
      <GestionarUsuarios
        onVolver={
          volverAdministracion
        }
      />
    );
  }


  /* =======================================================
     VISTA GESTIONAR MÓDULOS
     ======================================================= */

  if (
    vistaAdministracion ===
    "modulos"
  ) {

    return (
      <GestionarModulos
        onVolver={
          volverAdministracion
        }
      />
    );
  }


  /* =======================================================
     VISTA PRINCIPAL
     ======================================================= */

  return (
    <>

      <section className="system-page administracion-page">

        <div className="system-container">

          {/* ===========================================
              CABECERA
              =========================================== */}

          <header className="administracion-header">

            <h1 className="system-title">
              Administración
            </h1>


            <p className="system-subtitle">
              Gestiona usuarios y permisos de acceso del sistema.
            </p>

          </header>


          {/* ===========================================
              TARJETAS
              =========================================== */}

          <div className="administracion-grid">

            {/* =========================================
                USUARIOS
                ========================================= */}

            <article className="system-card administracion-card administracion-card-users">

              <div className="administracion-icon administracion-icon-users">

                <FaUsers />

              </div>


              <div className="administracion-card-body">

                <h2 className="administracion-card-title">
                  Usuarios
                </h2>


                <p className="administracion-card-description">
                  Registrar, visualizar y administrar usuarios del sistema.
                </p>

              </div>


              <div className="administracion-actions">

                <button
                  type="button"
                  className="app-btn app-btn-primary app-btn-block"
                  onClick={
                    abrirGestionUsuarios
                  }
                >
                  <FaUsers />

                  Gestionar usuarios
                </button>


                <button
                  type="button"
                  className="app-btn app-btn-cancel app-btn-block administracion-btn-users"
                  onClick={
                    openUserModal
                  }
                >
                  <FaPlus />

                  Nuevo usuario
                </button>

              </div>

            </article>


            {/* =========================================
                MÓDULOS
                ========================================= */}

            <article className="system-card administracion-card administracion-card-modules">

              <div className="administracion-icon administracion-icon-modules">

                <FaCube />

              </div>


              <div className="administracion-card-body">

                <h2 className="administracion-card-title">
                  Módulos
                </h2>


                <p className="administracion-card-description">
                  Gestiona los permisos de acceso a módulos y submódulos según el rol.
                </p>

              </div>


              <div className="administracion-actions">

                <button
                  type="button"
                  className="app-btn app-btn-primary app-btn-block administracion-btn-modules-primary"
                  onClick={
                    abrirGestionModulos
                  }
                >
                  <FaCube />

                  Gestionar módulos
                </button>

              </div>

            </article>

          </div>

        </div>

      </section>


      {/* =================================================
          MODAL NUEVO USUARIO
          ================================================= */}

      <ModalBase
        isOpen={
          isUserModalOpen
        }

        title="Nuevo usuario"

        onClose={
          closeUserModal
        }

        footer={
          <>

            <button
              type="button"
              className="app-btn app-btn-cancel"
              onClick={
                closeUserModal
              }
              disabled={
                guardandoUsuario
              }
            >
              Cancelar
            </button>


            <button
              type="submit"
              form="nuevo-usuario-form"
              className="app-btn app-btn-primary"
              disabled={
                loadingCatalogos ||
                guardandoUsuario
              }
            >
              {
                guardandoUsuario
                  ? "Creando usuario..."
                  : loadingCatalogos
                    ? "Cargando..."
                    : "Guardar usuario"
              }
            </button>

          </>
        }
      >

        {/* ===============================================
            CARGANDO CATÁLOGOS
            =============================================== */}

        {loadingCatalogos ? (

          <div className="system-empty-state">

            <span className="system-spinner" />


            <p>
              Cargando información...
            </p>

          </div>

        ) : (

          /* =============================================
             FORMULARIO
             ============================================= */

          <form
            id="nuevo-usuario-form"
            className="system-form"
            onSubmit={
              handleSubmit
            }
          >

            <div className="system-form-grid">

              {/* =========================================
                  NOMBRE
                  ========================================= */}

              <div className="system-form-group system-form-full">

                <label
                  className="system-form-label"
                  htmlFor="nuevo-usuario-nombre"
                >
                  Nombre completo

                  <span className="system-form-required">
                    *
                  </span>
                </label>


                <input
                  id="nuevo-usuario-nombre"
                  name="nombre"
                  type="text"
                  className="system-form-control"
                  placeholder="Ej. Juan Carlos Pérez García"
                  autoComplete="name"
                  disabled={
                    guardandoUsuario
                  }
                  required
                />

              </div>


              {/* =========================================
                  CORREO
                  ========================================= */}

              <div className="system-form-group system-form-full">

                <label
                  className="system-form-label"
                  htmlFor="nuevo-usuario-correo"
                >
                  Correo electrónico

                  <span className="system-form-required">
                    *
                  </span>
                </label>


                <input
                  id="nuevo-usuario-correo"
                  name="correo"
                  type="email"
                  className="system-form-control"
                  placeholder="usuario@ejemplo.com"
                  autoComplete="email"
                  disabled={
                    guardandoUsuario
                  }
                  required
                />

              </div>


              {/* =========================================
                  USUARIO
                  ========================================= */}

              <div className="system-form-group system-form-full">

                <label
                  className="system-form-label"
                  htmlFor="nuevo-usuario-usuario"
                >
                  Usuario

                  <span className="system-form-required">
                    *
                  </span>
                </label>


                <input
                  id="nuevo-usuario-usuario"
                  name="usuario"
                  type="text"
                  className="system-form-control"
                  placeholder="Ej. jperez"
                  autoComplete="username"
                  disabled={
                    guardandoUsuario
                  }
                  required
                />

              </div>


              {/* =========================================
                  ROL
                  ========================================= */}

              <div className="system-form-group">

                <label
                  className="system-form-label"
                  htmlFor="nuevo-usuario-rol"
                >
                  Rol

                  <span className="system-form-required">
                    *
                  </span>
                </label>


                <select
                  id="nuevo-usuario-rol"
                  name="rol_id"
                  className="system-form-select"
                  defaultValue=""
                  disabled={
                    guardandoUsuario
                  }
                  required
                >

                  <option
                    value=""
                    disabled
                  >
                    Seleccionar rol
                  </option>


                  {roles.map(
                    (rol) => (

                      <option
                        key={
                          rol.id
                        }
                        value={
                          rol.id
                        }
                      >
                        {rol.nombre}
                      </option>

                    )
                  )}

                </select>

              </div>


              {/* =========================================
                  ESTADO
                  ========================================= */}

              <div className="system-form-group">

                <label
                  className="system-form-label"
                  htmlFor="nuevo-usuario-estado"
                >
                  Estado

                  <span className="system-form-required">
                    *
                  </span>
                </label>


                <select
                  id="nuevo-usuario-estado"
                  name="estado_id"
                  className="system-form-select"
                  defaultValue=""
                  disabled={
                    guardandoUsuario
                  }
                  required
                >

                  <option
                    value=""
                    disabled
                  >
                    Seleccionar estado
                  </option>


                  {estadosUsuario.map(
                    (estado) => (

                      <option
                        key={
                          estado.id
                        }
                        value={
                          estado.id
                        }
                      >
                        {estado.nombre}
                      </option>

                    )
                  )}

                </select>

              </div>

            </div>

          </form>

        )}

      </ModalBase>

    </>
  );
};


export default CrearNuevoUsuario;