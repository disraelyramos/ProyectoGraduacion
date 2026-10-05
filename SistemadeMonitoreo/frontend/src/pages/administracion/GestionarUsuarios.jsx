import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";

import {
  FaArrowLeft,
  FaEnvelope,
  FaPen,
  FaSearch,
  FaToggleOn,
  FaTrash,
} from "react-icons/fa";

import ModalBase from "../../components/modals/ModalBase";

import {
  showBackendAlert,
  showConfirmAlert,
  showSessionExpiredAlert,
  showSuccessAlert,
} from "../../utils/alerts";


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const API_URL =
  import.meta.env.VITE_API_URL;


/* =========================================================
   NORMALIZAR TEXTO PARA BÚSQUEDA
   ========================================================= */

const normalizarBusqueda = (
  valor
) => {
  return String(
    valor || ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
};


/* =========================================================
   COMPONENTE
   ========================================================= */

const GestionarUsuarios = ({
  onVolver,
}) => {

  /* =======================================================
     USUARIOS
     ======================================================= */

  const [
    usuarios,
    setUsuarios,
  ] = useState([]);

  const [
    cargando,
    setCargando,
  ] = useState(true);


  /* =======================================================
     BÚSQUEDA
     ======================================================= */

  const [
    busqueda,
    setBusqueda,
  ] = useState("");


  /* =======================================================
     MODAL EDICIÓN
     ======================================================= */

  const [
    isEditModalOpen,
    setIsEditModalOpen,
  ] = useState(false);

  const [
    usuarioEdicion,
    setUsuarioEdicion,
  ] = useState(null);

  const [
    modoEdicion,
    setModoEdicion,
  ] = useState(null);

  const [
    guardandoEdicion,
    setGuardandoEdicion,
  ] = useState(false);


  /* =======================================================
     CATÁLOGO DE ROLES
     ======================================================= */

  const [
    roles,
    setRoles,
  ] = useState([]);

  const [
    cargandoRoles,
    setCargandoRoles,
  ] = useState(false);


  /* =======================================================
     ACCIÓN EN PROCESO
     ======================================================= */

  const [
    procesandoId,
    setProcesandoId,
  ] = useState(null);


  /* =======================================================
     MANEJO GENERAL DE ERRORES
     ======================================================= */

  const manejarError =
    useCallback(
      async (
        error,
        mensajeDefecto
      ) => {

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
                    mensajeDefecto,
                },
        });
      },
      []
    );


  /* =======================================================
     CARGAR USUARIOS
     ======================================================= */

  const cargarUsuarios =
    useCallback(
      async ({
        mostrarCarga = true,
      } = {}) => {

        const token =
          localStorage.getItem(
            "token"
          );


        if (!token) {
          await showSessionExpiredAlert();

          return;
        }


        if (mostrarCarga) {
          setCargando(true);
        }


        try {

          const response =
            await axios.get(
              `${API_URL}/api/administracion/usuarios`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );


          const usuariosRecibidos =
            Array.isArray(
              response.data?.usuarios
            )
              ? response.data.usuarios
              : [];


          setUsuarios(
            usuariosRecibidos
          );


        } catch (error) {

          await manejarError(
            error,
            "No fue posible cargar los usuarios."
          );


        } finally {

          if (mostrarCarga) {
            setCargando(false);
          }
        }
      },
      [
        manejarError,
      ]
    );


  /* =======================================================
     CARGA INICIAL
     ======================================================= */

  useEffect(() => {

    cargarUsuarios();

  }, [
    cargarUsuarios,
  ]);


  /* =======================================================
     USUARIOS FILTRADOS
     ======================================================= */

  const usuariosFiltrados =
    useMemo(
      () => {

        const termino =
          normalizarBusqueda(
            busqueda
          );


        if (!termino) {
          return usuarios;
        }


        return usuarios.filter(
          (usuarioItem) => {

            const nombre =
              normalizarBusqueda(
                usuarioItem.nombre
              );

            const usuario =
              normalizarBusqueda(
                usuarioItem.usuario
              );


            return (
              nombre.includes(
                termino
              ) ||
              usuario.includes(
                termino
              )
            );
          }
        );
      },
      [
        busqueda,
        usuarios,
      ]
    );


  /* =======================================================
     FORMATEAR FECHA
     ======================================================= */

  const formatearFecha = (
    fecha
  ) => {

    if (!fecha) {
      return "—";
    }


    const fechaObjeto =
      new Date(fecha);


    if (
      Number.isNaN(
        fechaObjeto.getTime()
      )
    ) {
      return "—";
    }


    return fechaObjeto
      .toLocaleDateString(
        "es-GT",
        {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }
      );
  };


  /* =======================================================
     CARGAR ROLES
     ======================================================= */

  const cargarRoles =
    async () => {

      if (roles.length > 0) {
        return true;
      }


      const token =
        localStorage.getItem(
          "token"
        );


      if (!token) {
        await showSessionExpiredAlert();

        return false;
      }


      setCargandoRoles(true);


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


        const rolesRecibidos =
          Array.isArray(
            response.data?.roles
          )
            ? response.data.roles
            : [];


        setRoles(
          rolesRecibidos
        );


        return true;


      } catch (error) {

        await manejarError(
          error,
          "No fue posible cargar los roles."
        );


        return false;


      } finally {

        setCargandoRoles(false);
      }
    };


  /* =======================================================
     ABRIR EDICIÓN COMPLETA
     ======================================================= */

  const abrirEdicionCompleta =
    async (
      usuarioItem
    ) => {

      /*
       * Este botón únicamente existe cuando
       * el backend devuelve:
       *
       * puedeEditarCompleto = true
       */

      const cargado =
        await cargarRoles();


      if (!cargado) {
        return;
      }


      setUsuarioEdicion(
        usuarioItem
      );

      setModoEdicion(
        "completo"
      );

      setIsEditModalOpen(
        true
      );
    };


  /* =======================================================
     ABRIR EDICIÓN DE CORREO
     ======================================================= */

  const abrirEdicionCorreo = (
    usuarioItem
  ) => {

    /*
     * Este botón únicamente existe cuando
     * el backend devuelve:
     *
     * puedeEditarCorreo = true
     */

    setUsuarioEdicion(
      usuarioItem
    );

    setModoEdicion(
      "correo"
    );

    setIsEditModalOpen(
      true
    );
  };


  /* =======================================================
     CERRAR MODAL
     ======================================================= */

  const cerrarModalEdicion = () => {

    if (guardandoEdicion) {
      return;
    }


    setIsEditModalOpen(
      false
    );

    setUsuarioEdicion(
      null
    );

    setModoEdicion(
      null
    );
  };


  /* =======================================================
     GUARDAR EDICIÓN
     ======================================================= */

  const guardarEdicion =
    async (
      event
    ) => {

      event.preventDefault();


      if (
        guardandoEdicion ||
        !usuarioEdicion
      ) {
        return;
      }


      const form =
        event.currentTarget;

      const formData =
        new FormData(
          form
        );


      let datos;


      if (
        modoEdicion ===
        "correo"
      ) {

        datos = {
          correo:
            String(
              formData.get(
                "correo"
              ) || ""
            ).trim(),
        };

      } else {

        datos = {
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
        };
      }


      if (!datos.correo) {

        await showBackendAlert({
          status: 400,

          data: {
            message:
              "El correo electrónico es obligatorio.",
          },
        });

        return;
      }


      if (
        modoEdicion ===
        "completo" &&
        (
          !datos.nombre ||
          !datos.usuario ||
          !Number.isSafeInteger(
            datos.rol_id
          ) ||
          datos.rol_id <= 0
        )
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


      await showConfirmAlert(
        modoEdicion === "correo"
          ? "¿Desea actualizar el correo?"
          : "¿Desea actualizar este usuario?",

        modoEdicion === "correo"
          ? `Se actualizará el correo de ${usuarioEdicion.nombre}.`
          : `Se actualizarán los datos de ${usuarioEdicion.nombre}.`,

        async () => {

          const token =
            localStorage.getItem(
              "token"
            );


          if (!token) {
            await showSessionExpiredAlert();

            return;
          }


          setGuardandoEdicion(
            true
          );


          try {

            const response =
              await axios.put(
                `${API_URL}/api/administracion/usuarios/${usuarioEdicion.id_usuario}`,
                datos,
                {
                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },
                }
              );


            await showSuccessAlert(
              response.data?.message ||
              "Usuario actualizado correctamente."
            );


            setIsEditModalOpen(
              false
            );

            setUsuarioEdicion(
              null
            );

            setModoEdicion(
              null
            );


            /*
             * Después de editar se vuelve a consultar
             * el backend.
             *
             * React no recalcula permisos localmente.
             */

            await cargarUsuarios({
              mostrarCarga: false,
            });


          } catch (error) {

            await manejarError(
              error,
              "No fue posible actualizar el usuario."
            );


          } finally {

            setGuardandoEdicion(
              false
            );
          }
        },

        null
      );
    };


  /* =======================================================
     CAMBIAR ESTADO
     ======================================================= */

  const cambiarEstado = async (
    usuarioItem
  ) => {

    const accion =
      usuarioItem.estado ===
      "Activo"
        ? "desactivar"
        : "activar";


    await showConfirmAlert(
      accion === "desactivar"
        ? "¿Desea desactivar este usuario?"
        : "¿Desea activar este usuario?",

      `${usuarioItem.nombre} será ${
        accion === "desactivar"
          ? "desactivado"
          : "activado"
      }.`,

      async () => {

        const token =
          localStorage.getItem(
            "token"
          );


        if (!token) {
          await showSessionExpiredAlert();

          return;
        }


        setProcesandoId(
          usuarioItem.id_usuario
        );


        try {

          const response =
            await axios.patch(
              `${API_URL}/api/administracion/usuarios/${usuarioItem.id_usuario}/estado`,
              {},
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );


          await showSuccessAlert(
            response.data?.message ||
            "Estado actualizado correctamente."
          );


          /*
           * Consultamos nuevamente el backend.
           * No cambiamos estado manualmente en React.
           */

          await cargarUsuarios({
            mostrarCarga: false,
          });


        } catch (error) {

          await manejarError(
            error,
            "No fue posible cambiar el estado del usuario."
          );


        } finally {

          setProcesandoId(
            null
          );
        }
      },

      null
    );
  };


  /* =======================================================
     ELIMINAR USUARIO
     ======================================================= */

  const eliminarUsuario = async (
    usuarioItem
  ) => {

    await showConfirmAlert(
      "¿Desea eliminar este usuario?",

      `Se eliminará permanentemente a ${usuarioItem.nombre}.`,

      async () => {

        const token =
          localStorage.getItem(
            "token"
          );


        if (!token) {
          await showSessionExpiredAlert();

          return;
        }


        setProcesandoId(
          usuarioItem.id_usuario
        );


        try {

          const response =
            await axios.delete(
              `${API_URL}/api/administracion/usuarios/${usuarioItem.id_usuario}`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );


          await showSuccessAlert(
            response.data?.message ||
            "Usuario eliminado correctamente."
          );


          /*
           * Se recarga desde BD.
           *
           * El frontend no elimina manualmente
           * el registro de la lista.
           */

          await cargarUsuarios({
            mostrarCarga: false,
          });


        } catch (error) {

          await manejarError(
            error,
            "No fue posible eliminar el usuario."
          );


        } finally {

          setProcesandoId(
            null
          );
        }
      },

      null
    );
  };


  /* =======================================================
     VISTA
     ======================================================= */

  return (
    <>
      <section className="system-page">

        <div className="system-container">

          {/* =================================================
              CABECERA
              ================================================= */}

          <div className="system-page-header">

            <div>

              <h1 className="system-title">
                Usuarios Registrados
              </h1>

              <p className="system-subtitle">
                Consulta y administra los usuarios registrados en el sistema.
              </p>

            </div>


            <button
              type="button"
              className="app-btn app-btn-primary"
              onClick={
                onVolver
              }
            >
              <FaArrowLeft />

              Volver
            </button>

          </div>


          {/* =================================================
              BUSCADOR
              ================================================= */}

          <div className="system-card gestion-usuarios-search-card">

            <div className="gestion-usuarios-search">

              <FaSearch
                className="gestion-usuarios-search-icon"
              />


              <input
                type="search"
                className="system-form-control gestion-usuarios-search-input"
                placeholder="Buscar por nombre o usuario..."
                value={
                  busqueda
                }
                onChange={
                  (event) =>
                    setBusqueda(
                      event.target.value
                    )
                }
              />

            </div>

          </div>


          {/* =================================================
              TABLA
              ================================================= */}

          <div className="system-card">

            {cargando ? (

              <div className="system-empty-state">

                <span className="system-spinner" />

                <p>
                  Cargando usuarios...
                </p>

              </div>

            ) : usuarios.length === 0 ? (

              <div className="system-empty-state">

                <p>
                  No hay usuarios registrados.
                </p>

              </div>

            ) : usuariosFiltrados.length ===
              0 ? (

              <div className="system-empty-state">

                <p>
                  No se encontraron usuarios con esa búsqueda.
                </p>

              </div>

            ) : (

              <div className="system-table-wrapper">

                <table className="system-table">

                  <thead>

                    <tr>

                      <th>
                        Nombre
                      </th>

                      <th>
                        Correo
                      </th>

                      <th>
                        Usuario
                      </th>

                      <th>
                        Rol
                      </th>

                      <th>
                        Estado
                      </th>

                      <th>
                        Fecha creación
                      </th>

                      <th className="system-table-actions">
                        Acciones
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {usuariosFiltrados.map(
                      (
                        usuarioItem
                      ) => {

                        /*
                         * React NO calcula permisos.
                         *
                         * Solo presenta las acciones
                         * que devolvió el backend.
                         */

                        const acciones =
                          usuarioItem.acciones ||
                          {};

                        const procesando =
                          procesandoId ===
                          usuarioItem.id_usuario;


                        return (

                          <tr
                            key={
                              usuarioItem.id_usuario
                            }
                          >

                            <td>
                              {
                                usuarioItem.nombre
                              }
                            </td>


                            <td>
                              {
                                usuarioItem.correo
                              }
                            </td>


                            <td>
                              {
                                usuarioItem.usuario
                              }
                            </td>


                            <td>
                              {
                                usuarioItem.rol
                              }
                            </td>


                            <td>

                              <span
                                className={
                                  usuarioItem.estado ===
                                  "Activo"
                                    ? "system-badge system-badge-success"
                                    : "system-badge system-badge-neutral"
                                }
                              >
                                {
                                  usuarioItem.estado
                                }
                              </span>

                            </td>


                            <td>
                              {
                                formatearFecha(
                                  usuarioItem.fecha_creacion
                                )
                              }
                            </td>


                            <td className="system-table-actions">

                              <div className="gestion-usuarios-actions">

                                {/* =========================
                                    EDITAR COMPLETO
                                    ========================= */}

                                {acciones
                                  .puedeEditarCompleto ===
                                  true && (

                                  <button
                                    type="button"
                                    className="app-btn app-btn-secondary gestion-usuarios-action-btn"
                                    title="Editar usuario"
                                    disabled={
                                      procesando
                                    }
                                    onClick={
                                      () =>
                                        abrirEdicionCompleta(
                                          usuarioItem
                                        )
                                    }
                                  >
                                    <FaPen />

                                    Editar
                                  </button>

                                )}


                                {/* =========================
                                    EDITAR CORREO
                                    ========================= */}

                                {acciones
                                  .puedeEditarCorreo ===
                                  true && (

                                  <button
                                    type="button"
                                    className="app-btn app-btn-secondary gestion-usuarios-action-btn"
                                    title="Editar correo"
                                    disabled={
                                      procesando
                                    }
                                    onClick={
                                      () =>
                                        abrirEdicionCorreo(
                                          usuarioItem
                                        )
                                    }
                                  >
                                    <FaEnvelope />

                                    Editar correo
                                  </button>

                                )}


                                {/* =========================
                                    CAMBIAR ESTADO
                                    ========================= */}

                                {acciones
                                  .puedeCambiarEstado ===
                                  true && (

                                  <button
                                    type="button"
                                    className="app-btn app-btn-cancel gestion-usuarios-action-btn"
                                    title={
                                      usuarioItem.estado ===
                                      "Activo"
                                        ? "Desactivar usuario"
                                        : "Activar usuario"
                                    }
                                    disabled={
                                      procesando
                                    }
                                    onClick={
                                      () =>
                                        cambiarEstado(
                                          usuarioItem
                                        )
                                    }
                                  >
                                    <FaToggleOn />

                                    {usuarioItem.estado ===
                                    "Activo"
                                      ? "Desactivar"
                                      : "Activar"}
                                  </button>

                                )}


                                {/* =========================
                                    ELIMINAR
                                    ========================= */}

                                {acciones
                                  .puedeEliminar ===
                                  true && (

                                  <button
                                    type="button"
                                    className="app-btn app-btn-danger gestion-usuarios-action-btn"
                                    title="Eliminar usuario"
                                    disabled={
                                      procesando
                                    }
                                    onClick={
                                      () =>
                                        eliminarUsuario(
                                          usuarioItem
                                        )
                                    }
                                  >
                                    <FaTrash />

                                    Eliminar
                                  </button>

                                )}

                              </div>

                            </td>

                          </tr>

                        );
                      }
                    )}

                  </tbody>

                </table>

              </div>

            )}

          </div>

        </div>

      </section>


      {/* ===================================================
          MODAL EDITAR USUARIO
          =================================================== */}

      <ModalBase
        isOpen={
          isEditModalOpen
        }
        title={
          modoEdicion ===
          "correo"
            ? "Editar correo"
            : "Editar usuario"
        }
        onClose={
          cerrarModalEdicion
        }
        footer={
          <>
            <button
              type="button"
              className="app-btn app-btn-cancel"
              onClick={
                cerrarModalEdicion
              }
              disabled={
                guardandoEdicion
              }
            >
              Cancelar
            </button>


            <button
              type="submit"
              form="editar-usuario-form"
              className="app-btn app-btn-primary"
              disabled={
                guardandoEdicion ||
                cargandoRoles
              }
            >
              {guardandoEdicion
                ? "Guardando..."
                : "Guardar cambios"}
            </button>
          </>
        }
      >

        {usuarioEdicion && (

          <form
            id="editar-usuario-form"
            className="system-form"
            onSubmit={
              guardarEdicion
            }
          >

            <div className="system-form-grid">

              {/* ===========================================
                  EDICIÓN COMPLETA
                  =========================================== */}

              {modoEdicion ===
                "completo" && (
                <>

                  <div className="system-form-group system-form-full">

                    <label
                      className="system-form-label"
                      htmlFor="editar-usuario-nombre"
                    >
                      Nombre completo

                      <span className="system-form-required">
                        *
                      </span>
                    </label>


                    <input
                      id="editar-usuario-nombre"
                      name="nombre"
                      type="text"
                      className="system-form-control"
                      defaultValue={
                        usuarioEdicion.nombre
                      }
                      disabled={
                        guardandoEdicion
                      }
                      required
                    />

                  </div>

                </>
              )}


              {/* ===========================================
                  CORREO
                  =========================================== */}

              <div className="system-form-group system-form-full">

                <label
                  className="system-form-label"
                  htmlFor="editar-usuario-correo"
                >
                  Correo electrónico

                  <span className="system-form-required">
                    *
                  </span>
                </label>


                <input
                  id="editar-usuario-correo"
                  name="correo"
                  type="email"
                  className="system-form-control"
                  defaultValue={
                    usuarioEdicion.correo
                  }
                  disabled={
                    guardandoEdicion
                  }
                  required
                />

              </div>


              {/* ===========================================
                  RESTO DE CAMPOS SOLO EN EDICIÓN COMPLETA
                  =========================================== */}

              {modoEdicion ===
                "completo" && (
                <>

                  <div className="system-form-group system-form-full">

                    <label
                      className="system-form-label"
                      htmlFor="editar-usuario-usuario"
                    >
                      Usuario

                      <span className="system-form-required">
                        *
                      </span>
                    </label>


                    <input
                      id="editar-usuario-usuario"
                      name="usuario"
                      type="text"
                      className="system-form-control"
                      defaultValue={
                        usuarioEdicion.usuario
                      }
                      disabled={
                        guardandoEdicion
                      }
                      required
                    />

                  </div>


                  <div className="system-form-group system-form-full">

                    <label
                      className="system-form-label"
                      htmlFor="editar-usuario-rol"
                    >
                      Rol

                      <span className="system-form-required">
                        *
                      </span>
                    </label>


                    <select
                      id="editar-usuario-rol"
                      name="rol_id"
                      className="system-form-select"
                      defaultValue={
                        String(
                          usuarioEdicion.rol_id
                        )
                      }
                      disabled={
                        guardandoEdicion ||
                        cargandoRoles
                      }
                      required
                    >

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

                </>
              )}

            </div>

          </form>

        )}

      </ModalBase>

    </>
  );
};


export default GestionarUsuarios;