import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";

import {
  FaArrowLeft,
  FaCube,
  FaLock,
} from "react-icons/fa";

import {
  showBackendAlert,
  showConfirmAlert,
  showSessionExpiredAlert,
  showSuccessAlert,
} from "../../utils/alerts";

import "../../styles/administracion.css";


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const API_URL =
  import.meta.env.VITE_API_URL;


/* =========================================================
   FORMATEAR NOMBRES PARA LA VISTA
   ========================================================= */

const formatearNombre = (
  valor
) => {

  const texto =
    String(
      valor || ""
    )
      .replace(
        /_/g,
        " "
      )
      .trim();


  if (!texto) {
    return "";
  }


  return texto
    .split(/\s+/)
    .map(
      (palabra) => {

        if (
          palabra
            .toLowerCase() ===
          "dsh"
        ) {
          return "DSH";
        }


        return (
          palabra
            .charAt(0)
            .toUpperCase() +
          palabra
            .slice(1)
            .toLowerCase()
        );
      }
    )
    .join(" ");
};


/* =========================================================
   CLAVE DE PERMISO
   ========================================================= */

const crearClavePermiso = (
  moduloId,
  submoduloId
) => {

  return `${moduloId}:${
    submoduloId === null
      ? "null"
      : submoduloId
  }`;
};


/* =========================================================
   COMPONENTE
   ========================================================= */

const GestionarModulos = ({
  onVolver,
}) => {

  /* =======================================================
     CATÁLOGO
     ======================================================= */

  const [
    modulos,
    setModulos,
  ] = useState([]);

  const [
    roles,
    setRoles,
  ] = useState([]);

  const [
    cargando,
    setCargando,
  ] = useState(true);


  /* =======================================================
     ROL SELECCIONADO
     ======================================================= */

  const [
    rolSeleccionado,
    setRolSeleccionado,
  ] = useState("");


  /* =======================================================
     INFORMACIÓN DEL ROL
     ======================================================= */

  const [
    rolActual,
    setRolActual,
  ] = useState(null);

  const [
    permisosOriginales,
    setPermisosOriginales,
  ] = useState([]);

  const [
    permisosSeleccionados,
    setPermisosSeleccionados,
  ] = useState(
    new Set()
  );

  const [
    cargandoPermisos,
    setCargandoPermisos,
  ] = useState(false);

  const [
    guardando,
    setGuardando,
  ] = useState(false);


  /* =======================================================
     MANEJO GENERAL DE ERROR
     ======================================================= */

  const manejarError =
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
            ? error.response.data
            : {
                message:
                  mensajeDefecto,
              },
      });
    };


  /* =======================================================
     CARGAR CATÁLOGO
     ======================================================= */

  useEffect(() => {

    let componenteActivo =
      true;


    const cargarCatalogo =
      async () => {

        const token =
          localStorage.getItem(
            "token"
          );


        if (!token) {

          await showSessionExpiredAlert();

          return;
        }


        setCargando(
          true
        );


        try {

          const response =
            await axios.get(
              `${API_URL}/api/permisos/catalogo`,
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


          setModulos(
            Array.isArray(
              response.data?.modulos
            )
              ? response.data.modulos
              : []
          );


          setRoles(
            Array.isArray(
              response.data?.roles
            )
              ? response.data.roles
              : []
          );


        } catch (error) {

          if (!componenteActivo) {
            return;
          }


          await manejarError(
            error,
            "No fue posible cargar los módulos del sistema."
          );


        } finally {

          if (componenteActivo) {

            setCargando(
              false
            );
          }
        }
      };


    cargarCatalogo();


    return () => {

      componenteActivo =
        false;
    };

  }, []);


  /* =======================================================
     CARGAR PERMISOS DEL ROL
     ======================================================= */

  useEffect(() => {

    if (!rolSeleccionado) {

      setRolActual(
        null
      );

      setPermisosOriginales(
        []
      );

      setPermisosSeleccionados(
        new Set()
      );

      return;
    }


    let componenteActivo =
      true;


    const cargarPermisosRol =
      async () => {

        const token =
          localStorage.getItem(
            "token"
          );


        if (!token) {

          await showSessionExpiredAlert();

          return;
        }


        setCargandoPermisos(
          true
        );


        try {

          const response =
            await axios.get(
              `${API_URL}/api/permisos/rol/${rolSeleccionado}`,
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


          const permisosRecibidos =
            Array.isArray(
              response.data?.permisos
            )
              ? response.data.permisos
              : [];


          setRolActual(
            response.data?.rol ||
            null
          );


          setPermisosOriginales(
            permisosRecibidos
          );


          const activos =
            new Set(
              permisosRecibidos
                .filter(
                  (permiso) =>
                    permiso.active ===
                    true
                )
                .map(
                  (permiso) =>
                    crearClavePermiso(
                      permiso.modulo_id,
                      permiso.submodulo_id ??
                        null
                    )
                )
            );


          setPermisosSeleccionados(
            activos
          );


        } catch (error) {

          if (!componenteActivo) {
            return;
          }


          setRolActual(
            null
          );

          setPermisosOriginales(
            []
          );

          setPermisosSeleccionados(
            new Set()
          );


          await manejarError(
            error,
            "No fue posible cargar los permisos del rol."
          );


        } finally {

          if (componenteActivo) {

            setCargandoPermisos(
              false
            );
          }
        }
      };


    cargarPermisosRol();


    return () => {

      componenteActivo =
        false;
    };

  }, [rolSeleccionado]);


  /* =======================================================
     PERMISOS ORIGINALES ACTIVOS
     ======================================================= */

  const permisosOriginalesActivos =
    useMemo(
      () => {

        return new Set(
          permisosOriginales
            .filter(
              (permiso) =>
                permiso.active ===
                true
            )
            .map(
              (permiso) =>
                crearClavePermiso(
                  permiso.modulo_id,
                  permiso.submodulo_id ??
                    null
                )
            )
        );

      },
      [
        permisosOriginales,
      ]
    );


  /* =======================================================
     PERMISOS PROTEGIDOS DEL ADMINISTRADOR
     ======================================================= */

  const permisosAdministradorProtegidos =
    useMemo(
      () => {

        if (
          rolActual
            ?.esAdministrador !==
          true
        ) {
          return new Set();
        }


        return new Set(
          permisosOriginalesActivos
        );

      },
      [
        permisosOriginalesActivos,
        rolActual,
      ]
    );


  /* =======================================================
     VALIDAR SI HAY CAMBIOS
     ======================================================= */

  const hayCambios =
    useMemo(
      () => {

        if (
          permisosOriginalesActivos.size !==
          permisosSeleccionados.size
        ) {
          return true;
        }


        for (
          const clave
          of permisosOriginalesActivos
        ) {

          if (
            !permisosSeleccionados.has(
              clave
            )
          ) {
            return true;
          }
        }


        return false;

      },
      [
        permisosOriginalesActivos,
        permisosSeleccionados,
      ]
    );


  /* =======================================================
     VALIDAR CHECK
     ======================================================= */

  const estaSeleccionado = (
    moduloId,
    submoduloId
  ) => {

    return permisosSeleccionados.has(
      crearClavePermiso(
        moduloId,
        submoduloId
      )
    );
  };


  /* =======================================================
     CAMBIAR SUBMÓDULO
     ======================================================= */

  const cambiarSubmodulo = (
    moduloId,
    submoduloId
  ) => {

    const clave =
      crearClavePermiso(
        moduloId,
        submoduloId
      );


    if (
      permisosAdministradorProtegidos.has(
        clave
      )
    ) {
      return;
    }


    setPermisosSeleccionados(
      (actuales) => {

        const nuevos =
          new Set(
            actuales
          );


        if (
          nuevos.has(
            clave
          )
        ) {

          nuevos.delete(
            clave
          );

        } else {

          nuevos.add(
            clave
          );
        }


        return nuevos;
      }
    );
  };


  /* =======================================================
     CAMBIAR MÓDULO SIN SUBMÓDULOS
     ======================================================= */

  const cambiarModuloDirecto = (
    moduloId
  ) => {

    const clave =
      crearClavePermiso(
        moduloId,
        null
      );


    if (
      permisosAdministradorProtegidos.has(
        clave
      )
    ) {
      return;
    }


    setPermisosSeleccionados(
      (actuales) => {

        const nuevos =
          new Set(
            actuales
          );


        if (
          nuevos.has(
            clave
          )
        ) {

          nuevos.delete(
            clave
          );

        } else {

          nuevos.add(
            clave
          );
        }


        return nuevos;
      }
    );
  };


  /* =======================================================
     VALIDAR SI MÓDULO ESTÁ ACTIVO
     ======================================================= */

  const tieneAccesoModulo = (
    modulo
  ) => {

    if (
      estaSeleccionado(
        modulo.id,
        null
      )
    ) {
      return true;
    }


    return (
      Array.isArray(
        modulo.submodulos
      ) &&
      modulo.submodulos.some(
        (submodulo) =>
          estaSeleccionado(
            modulo.id,
            submodulo.id
          )
      )
    );
  };


  /* =======================================================
     CAMBIAR ROL
     ======================================================= */

  const cambiarRol = (
    event
  ) => {

    setRolSeleccionado(
      event.target.value
    );
  };


  /* =======================================================
     CANCELAR CAMBIOS
     ======================================================= */

  const cancelarCambios = () => {

    setPermisosSeleccionados(
      new Set(
        permisosOriginalesActivos
      )
    );
  };


  /* =======================================================
     CONSTRUIR PERMISOS PARA BACKEND
     ======================================================= */

  const construirPermisos =
    () => {

      const resultado =
        [];


      for (
        const modulo
        of modulos
      ) {

        const tieneSubmodulos =
          Array.isArray(
            modulo.submodulos
          ) &&
          modulo.submodulos.length >
            0;


        if (!tieneSubmodulos) {

          if (
            estaSeleccionado(
              modulo.id,
              null
            )
          ) {

            resultado.push({
              modulo_id:
                modulo.id,

              submodulo_id:
                null,
            });
          }


          continue;
        }


        for (
          const submodulo
          of modulo.submodulos
        ) {

          if (
            estaSeleccionado(
              modulo.id,
              submodulo.id
            )
          ) {

            resultado.push({
              modulo_id:
                modulo.id,

              submodulo_id:
                submodulo.id,
            });
          }
        }
      }


      return resultado;
    };


  /* =======================================================
     GUARDAR CAMBIOS
     ======================================================= */

  const guardarCambios =
    async () => {

      if (
        !rolSeleccionado ||
        !rolActual ||
        !hayCambios ||
        guardando
      ) {
        return;
      }


      await showConfirmAlert(
        "¿Desea guardar los permisos?",

        `Se actualizarán los accesos del rol ${rolActual.nombre}.`,

        async () => {

          const token =
            localStorage.getItem(
              "token"
            );


          if (!token) {

            await showSessionExpiredAlert();

            return;
          }


          setGuardando(
            true
          );


          try {

            const permisos =
              construirPermisos();


            const response =
              await axios.put(
                `${API_URL}/api/permisos/rol/${rolSeleccionado}`,
                {
                  permisos,
                },
                {
                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },
                }
              );


            const permisosActualizados =
              Array.isArray(
                response.data?.permisos
              )
                ? response.data.permisos
                : [];


            setRolActual(
              response.data?.rol ||
              rolActual
            );


            setPermisosOriginales(
              permisosActualizados
            );


            const activos =
              new Set(
                permisosActualizados
                  .filter(
                    (permiso) =>
                      permiso.active ===
                      true
                  )
                  .map(
                    (permiso) =>
                      crearClavePermiso(
                        permiso.modulo_id,
                        permiso.submodulo_id ??
                          null
                      )
                  )
              );


            setPermisosSeleccionados(
              activos
            );


            await showSuccessAlert(
              response.data?.message ||
              "Permisos actualizados correctamente."
            );


          } catch (error) {

            await manejarError(
              error,
              "No fue posible actualizar los permisos."
            );


          } finally {

            setGuardando(
              false
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

    <section className="system-page administracion-page">

      <div className="system-container">

        {/* =================================================
            CABECERA
            ================================================= */}

        <div className="system-page-header">

          <div>

            <h1 className="system-title">
              Módulos y accesos
            </h1>


            <p className="system-subtitle">
              Gestiona los permisos de acceso a módulos y submódulos según el rol.
            </p>

          </div>


          <button
            type="button"
            className="app-btn app-btn-primary"
            onClick={
              onVolver
            }
            disabled={
              guardando
            }
          >
            <FaArrowLeft />

            Volver
          </button>

        </div>


        {/* =================================================
            CARGANDO CATÁLOGO
            ================================================= */}

        {cargando ? (

          <div className="system-card">

            <div className="system-empty-state">

              <span className="system-spinner" />

              <p>
                Cargando módulos...
              </p>

            </div>

          </div>

        ) : modulos.length === 0 ? (

          <div className="system-card">

            <div className="system-empty-state">

              <p>
                No hay módulos registrados.
              </p>

            </div>

          </div>

        ) : (

          <>

            {/* =============================================
                SELECCIÓN DE ROL
                ============================================= */}

            <div className="system-card">

              <div className="system-form-group">

                <label
                  className="system-form-label"
                  htmlFor="permisos-rol"
                >
                  Seleccionar rol
                </label>


                <select
                  id="permisos-rol"
                  className="system-form-select"
                  value={
                    rolSeleccionado
                  }
                  onChange={
                    cambiarRol
                  }
                  disabled={
                    cargandoPermisos ||
                    guardando
                  }
                >

                  <option value="">
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
                        {formatearNombre(
                          rol.nombre
                        )}
                      </option>

                    )
                  )}

                </select>

              </div>


              {/* ===========================================
                  ADMINISTRADOR PROTEGIDO
                  =========================================== */}

              {rolActual
                ?.esAdministrador ===
                true && (

                <div
                  style={{
                    marginTop:
                      "16px",
                  }}
                >

                  <span className="system-badge system-badge-success">

                    <FaLock />

                    Administrador protegido

                  </span>


                  <p
                    className="system-subtitle"
                    style={{
                      marginTop:
                        "8px",
                    }}
                  >
                    Los permisos existentes del Administrador no pueden desmarcarse.
                  </p>

                </div>

              )}

            </div>


            {/* =============================================
                CONTENIDO
                ============================================= */}

            {!rolSeleccionado ? (

              <div className="system-card">

                <div className="system-empty-state">

                  <p>
                    Selecciona un rol para administrar sus permisos.
                  </p>

                </div>

              </div>

            ) : cargandoPermisos ? (

              <div className="system-card">

                <div className="system-empty-state">

                  <span className="system-spinner" />

                  <p>
                    Cargando permisos...
                  </p>

                </div>

              </div>

            ) : (

              <>

                {/* ===========================================
                    MÓDULOS
                    =========================================== */}

                <div
                  style={{
                    marginTop:
                      "20px",
                  }}
                >

                  {modulos.map(
                    (modulo) => {

                      const tieneSubmodulos =
                        Array.isArray(
                          modulo.submodulos
                        ) &&
                        modulo
                          .submodulos
                          .length >
                          0;


                      const moduloActivo =
                        tieneAccesoModulo(
                          modulo
                        );


                      const claveModulo =
                        crearClavePermiso(
                          modulo.id,
                          null
                        );


                      const moduloProtegido =
                        permisosAdministradorProtegidos.has(
                          claveModulo
                        );


                      return (

                        <div
                          key={
                            modulo.id
                          }
                          className="system-card"
                          style={{
                            marginBottom:
                              "16px",
                          }}
                        >

                          {/* ===============================
                              MÓDULO
                              =============================== */}

                          <div
                            style={{
                              display:
                                "flex",
                              alignItems:
                                "center",
                              gap:
                                "12px",
                            }}
                          >

                            <input
                              type="checkbox"
                              checked={
                                moduloActivo
                              }
                              onChange={
                                tieneSubmodulos
                                  ? undefined
                                  : () =>
                                      cambiarModuloDirecto(
                                        modulo.id
                                      )
                              }
                              disabled={
                                guardando ||
                                tieneSubmodulos ||
                                moduloProtegido
                              }
                            />


                            <FaCube />


                            <h2
                              className="administracion-card-title"
                              style={{
                                margin:
                                  0,
                              }}
                            >
                              {formatearNombre(
                                modulo.nombre
                              )}
                            </h2>


                            {moduloProtegido &&
                              !tieneSubmodulos && (

                              <FaLock
                                title="Permiso protegido del Administrador"
                              />

                            )}

                          </div>


                          {/* ===============================
                              SUBMÓDULOS
                              =============================== */}

                          {tieneSubmodulos ? (

                            <div
                              style={{
                                marginTop:
                                  "16px",
                                marginLeft:
                                  "34px",
                              }}
                            >

                              {modulo.submodulos.map(
                                (
                                  submodulo
                                ) => {

                                  const clave =
                                    crearClavePermiso(
                                      modulo.id,
                                      submodulo.id
                                    );


                                  const bloqueado =
                                    permisosAdministradorProtegidos.has(
                                      clave
                                    );


                                  return (

                                    <label
                                      key={
                                        submodulo.id
                                      }
                                      style={{
                                        display:
                                          "flex",
                                        alignItems:
                                          "center",
                                        gap:
                                          "10px",
                                        marginBottom:
                                          "10px",
                                        cursor:
                                          bloqueado ||
                                          guardando
                                            ? "not-allowed"
                                            : "pointer",
                                      }}
                                    >

                                      <input
                                        type="checkbox"
                                        checked={
                                          estaSeleccionado(
                                            modulo.id,
                                            submodulo.id
                                          )
                                        }
                                        disabled={
                                          bloqueado ||
                                          guardando
                                        }
                                        onChange={
                                          () =>
                                            cambiarSubmodulo(
                                              modulo.id,
                                              submodulo.id
                                            )
                                        }
                                      />


                                      <span>
                                        {formatearNombre(
                                          submodulo.nombre
                                        )}
                                      </span>


                                      {bloqueado && (

                                        <FaLock
                                          title="Permiso protegido del Administrador"
                                        />

                                      )}

                                    </label>

                                  );
                                }
                              )}

                            </div>

                          ) : (

                            <p
                              className="administracion-card-description"
                              style={{
                                marginTop:
                                  "12px",
                                marginLeft:
                                  "34px",
                              }}
                            >
                              Este módulo no tiene submódulos.
                            </p>

                          )}

                        </div>

                      );
                    }
                  )}

                </div>


                {/* ===========================================
                    BOTONES
                    =========================================== */}

                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "flex-end",
                    gap:
                      "12px",
                    marginTop:
                      "20px",
                    marginBottom:
                      "20px",
                  }}
                >

                  <button
                    type="button"
                    className="app-btn app-btn-cancel"
                    onClick={
                      cancelarCambios
                    }
                    disabled={
                      guardando ||
                      !hayCambios
                    }
                  >
                    Cancelar cambios
                  </button>


                  <button
                    type="button"
                    className="app-btn app-btn-primary"
                    onClick={
                      guardarCambios
                    }
                    disabled={
                      guardando ||
                      !hayCambios
                    }
                  >
                    {guardando
                      ? "Guardando..."
                      : "Guardar cambios"}
                  </button>

                </div>

              </>

            )}

          </>

        )}

      </div>

    </section>
  );
};


export default GestionarModulos;