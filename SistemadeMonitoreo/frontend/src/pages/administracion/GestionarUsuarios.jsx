
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";

import {
  FaArrowLeft,
  FaPhone,
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

// ======================================================
// CONFIGURACIÓN
// ======================================================

const API_URL = import.meta.env.VITE_API_URL;

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

const normalizarBusqueda = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const formatearFecha = (fecha) => {
  if (!fecha) return "—";

  const fechaObjeto = new Date(fecha);

  if (Number.isNaN(fechaObjeto.getTime())) {
    return "—";
  }

  return fechaObjeto.toLocaleDateString("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const telefonoValido = (telefono) =>
  /^[345]\d{7}$/.test(telefono);

// ======================================================
// COMPONENTE
// ======================================================

const GestionarUsuarios = ({ onVolver }) => {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const [isEditModalOpen, setIsEditModalOpen] =
    useState(false);

  const [usuarioEdicion, setUsuarioEdicion] =
    useState(null);

  const [modoEdicion, setModoEdicion] =
    useState(null);

  const [guardandoEdicion, setGuardandoEdicion] =
    useState(false);

  const [roles, setRoles] = useState([]);

  const [cargandoRoles, setCargandoRoles] =
    useState(false);

  const [procesandoId, setProcesandoId] =
    useState(null);

  // ====================================================
  // MANEJO DE ERRORES
  // ====================================================

  const manejarError = useCallback(
    async (error, mensajeDefecto) => {
      const status =
        Number(error?.response?.status) || 500;

      if (status === 401) {
        await showSessionExpiredAlert();
        return;
      }

      await showBackendAlert({
        status,
        data:
          error?.response?.data &&
          typeof error.response.data === "object"
            ? error.response.data
            : { message: mensajeDefecto },
      });
    },
    []
  );

  // ====================================================
  // OBTENER TOKEN
  // ====================================================

  const obtenerToken = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      await showSessionExpiredAlert();
      return null;
    }

    return token;
  };

  // ====================================================
  // CARGAR USUARIOS
  // ====================================================

  const cargarUsuarios = useCallback(
    async ({ mostrarCarga = true } = {}) => {
      const token = localStorage.getItem("token");

      if (!token) {
        setCargando(false);
        await showSessionExpiredAlert();
        return;
      }

      if (mostrarCarga) setCargando(true);

      try {
        const response = await axios.get(
          `${API_URL}/api/administracion/usuarios`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setUsuarios(
          Array.isArray(response.data?.usuarios)
            ? response.data.usuarios
            : []
        );
      } catch (error) {
        await manejarError(
          error,
          "No fue posible cargar los usuarios."
        );
      } finally {
        if (mostrarCarga) setCargando(false);
      }
    },
    [manejarError]
  );

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  // ====================================================
  // BUSCAR USUARIOS
  // ====================================================

  const usuariosFiltrados = useMemo(() => {
    const termino = normalizarBusqueda(busqueda);

    if (!termino) return usuarios;

    return usuarios.filter((item) => {
      const nombre = normalizarBusqueda(item.nombre);
      const usuario = normalizarBusqueda(item.usuario);

      return (
        nombre.includes(termino) ||
        usuario.includes(termino)
      );
    });
  }, [busqueda, usuarios]);

  // ====================================================
  // CARGAR ROLES
  // ====================================================

  const cargarRoles = async () => {
    if (roles.length > 0) return true;

    const token = await obtenerToken();
    if (!token) return false;

    setCargandoRoles(true);

    try {
      const response = await axios.get(
        `${API_URL}/api/administracion/catalogos`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setRoles(
        Array.isArray(response.data?.roles)
          ? response.data.roles
          : []
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

  // ====================================================
  // ABRIR EDICIÓN COMPLETA
  // ====================================================

  const abrirEdicionCompleta = async (item) => {
    if (item.acciones?.puedeEditarCompleto !== true) {
      return;
    }

    const cargado = await cargarRoles();

    if (!cargado) return;

    setUsuarioEdicion(item);
    setModoEdicion("completo");
    setIsEditModalOpen(true);
  };

  // ====================================================
  // ABRIR EDICIÓN DE CELULAR
  // ====================================================

  const abrirEdicionCelular = (item) => {
    if (item.acciones?.puedeEditarCelular !== true) {
      return;
    }

    setUsuarioEdicion(item);
    setModoEdicion("celular");
    setIsEditModalOpen(true);
  };

  // ====================================================
  // CERRAR MODAL
  // ====================================================

  const cerrarModalEdicion = () => {
    if (guardandoEdicion) return;

    setIsEditModalOpen(false);
    setUsuarioEdicion(null);
    setModoEdicion(null);
  };

  // ====================================================
  // GUARDAR EDICIÓN
  // ====================================================

  const guardarEdicion = async (event) => {
    event.preventDefault();

    if (guardandoEdicion || !usuarioEdicion) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    let datos;

    if (modoEdicion === "celular") {
      const telefono = String(
        formData.get("telefono") || ""
      ).trim();

      if (!telefonoValido(telefono)) {
        await showBackendAlert({
          status: 400,
          data: {
            message:
              "Ingrese un celular guatemalteco válido de 8 dígitos.",
          },
        });
        return;
      }

      // Solo se envía el teléfono.
      datos = { telefono };
    } else if (modoEdicion === "completo") {
      datos = {
        nombre: String(
          formData.get("nombre") || ""
        ).trim(),

        correo: String(
          formData.get("correo") || ""
        ).trim(),

        usuario: String(
          formData.get("usuario") || ""
        ).trim(),

        rol_id: Number(formData.get("rol_id")),
      };

      const telefono = String(
        formData.get("telefono") || ""
      ).trim();

      if (telefono) {
        if (!telefonoValido(telefono)) {
          await showBackendAlert({
            status: 400,
            data: {
              message:
                "El celular debe tener 8 dígitos válidos.",
            },
          });
          return;
        }

        datos.telefono = telefono;
      }

      if (
        !datos.nombre ||
        !datos.correo ||
        !datos.usuario ||
        !Number.isSafeInteger(datos.rol_id) ||
        datos.rol_id <= 0
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

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)) {
        await showBackendAlert({
          status: 400,
          data: {
            message:
              "El formato del correo electrónico no es válido.",
          },
        });
        return;
      }
    } else {
      return;
    }

    const soloCelular = modoEdicion === "celular";

    await showConfirmAlert(
      soloCelular
        ? "¿Desea actualizar el celular?"
        : "¿Desea actualizar este usuario?",

      soloCelular
        ? `Se actualizará el celular de ${usuarioEdicion.nombre}.`
        : `Se actualizarán los datos de ${usuarioEdicion.nombre}.`,

      async () => {
        const token = await obtenerToken();
        if (!token) return;

        setGuardandoEdicion(true);

        try {
          const response = await axios.put(
            `${API_URL}/api/administracion/usuarios/${usuarioEdicion.id_usuario}`,
            datos,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          await showSuccessAlert(
            response.data?.message ||
              "Usuario actualizado correctamente."
          );

          setIsEditModalOpen(false);
          setUsuarioEdicion(null);
          setModoEdicion(null);

          // El backend es la fuente de verdad.
          await cargarUsuarios({
            mostrarCarga: false,
          });
        } catch (error) {
          await manejarError(
            error,
            "No fue posible actualizar el usuario."
          );
        } finally {
          setGuardandoEdicion(false);
        }
      },
      null
    );
  };

  // ====================================================
  // CAMBIAR ESTADO
  // ====================================================

  const cambiarEstado = async (item) => {
    if (item.acciones?.puedeCambiarEstado !== true) {
      return;
    }

    const desactivar =
      String(item.estado).toLowerCase() === "activo";

    await showConfirmAlert(
      desactivar
        ? "¿Desea desactivar este usuario?"
        : "¿Desea activar este usuario?",

      `${item.nombre} será ${
        desactivar ? "desactivado" : "activado"
      }.`,

      async () => {
        const token = await obtenerToken();
        if (!token) return;

        setProcesandoId(item.id_usuario);

        try {
          const response = await axios.patch(
            `${API_URL}/api/administracion/usuarios/${item.id_usuario}/estado`,
            {},
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          await showSuccessAlert(
            response.data?.message ||
              "Estado actualizado correctamente."
          );

          await cargarUsuarios({
            mostrarCarga: false,
          });
        } catch (error) {
          await manejarError(
            error,
            "No fue posible cambiar el estado."
          );
        } finally {
          setProcesandoId(null);
        }
      },
      null
    );
  };

  // ====================================================
  // ELIMINAR USUARIO
  // ====================================================

  const eliminarUsuario = async (item) => {
    if (item.acciones?.puedeEliminar !== true) {
      return;
    }

    await showConfirmAlert(
      "¿Desea eliminar este usuario?",
      `Se eliminará permanentemente a ${item.nombre}.`,

      async () => {
        const token = await obtenerToken();
        if (!token) return;

        setProcesandoId(item.id_usuario);

        try {
          const response = await axios.delete(
            `${API_URL}/api/administracion/usuarios/${item.id_usuario}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          await showSuccessAlert(
            response.data?.message ||
              "Usuario eliminado correctamente."
          );

          await cargarUsuarios({
            mostrarCarga: false,
          });
        } catch (error) {
          await manejarError(
            error,
            "No fue posible eliminar el usuario."
          );
        } finally {
          setProcesandoId(null);
        }
      },
      null
    );
  };

  // ====================================================
  // VISTA
  // ====================================================

  return (
    <>
      <section className="system-page">
        <div className="system-container">

          {/* CABECERA */}

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
              onClick={onVolver}
            >
              <FaArrowLeft />
              Volver
            </button>
          </div>

          {/* BUSCADOR */}

          <div className="system-card gestion-usuarios-search-card">
            <div className="gestion-usuarios-search">
              <FaSearch className="gestion-usuarios-search-icon" />

              <input
                type="search"
                className="system-form-control gestion-usuarios-search-input"
                placeholder="Buscar por nombre o usuario..."
                value={busqueda}
                onChange={(event) =>
                  setBusqueda(event.target.value)
                }
              />
            </div>
          </div>

          {/* TABLA */}

          <div className="system-card">
            {cargando ? (
              <div className="system-empty-state">
                <span className="system-spinner" />
                <p>Cargando usuarios...</p>
              </div>
            ) : usuarios.length === 0 ? (
              <div className="system-empty-state">
                <p>No hay usuarios registrados.</p>
              </div>
            ) : usuariosFiltrados.length === 0 ? (
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
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Fecha creación</th>
                      <th className="system-table-actions">
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {usuariosFiltrados.map((item) => {
                      const acciones = item.acciones || {};
                      const procesando =
                        procesandoId === item.id_usuario;

                      const esActivo =
                        String(item.estado).toLowerCase() ===
                        "activo";

                      return (
                        <tr key={item.id_usuario}>
                          <td>{item.nombre}</td>
                          <td>{item.correo}</td>
                          <td>{item.usuario}</td>
                          <td>{item.rol}</td>

                          <td>
                            <span
                              className={
                                esActivo
                                  ? "system-badge system-badge-success"
                                  : "system-badge system-badge-neutral"
                              }
                            >
                              {item.estado}
                            </span>
                          </td>

                          <td>
                            {formatearFecha(item.fecha_creacion)}
                          </td>

                          <td className="system-table-actions">
                            <div className="gestion-usuarios-actions">

                              {/* EDITAR COMPLETO */}

                              {acciones.puedeEditarCompleto === true && (
                                <button
                                  type="button"
                                  className="app-btn app-btn-secondary gestion-usuarios-action-btn"
                                  title="Editar usuario"
                                  disabled={procesando}
                                  onClick={() =>
                                    abrirEdicionCompleta(item)
                                  }
                                >
                                  <FaPen />
                                  Editar
                                </button>
                              )}

                              {/* EDITAR CELULAR */}

                              {acciones.puedeEditarCelular === true && (
                                <button
                                  type="button"
                                  className="app-btn app-btn-secondary gestion-usuarios-action-btn"
                                  title="Editar celular"
                                  disabled={procesando}
                                  onClick={() =>
                                    abrirEdicionCelular(item)
                                  }
                                >
                                  <FaPhone />
                                  Editar celular
                                </button>
                              )}

                              {/* CAMBIAR ESTADO */}

                              {acciones.puedeCambiarEstado === true && (
                                <button
                                  type="button"
                                  className="app-btn app-btn-cancel gestion-usuarios-action-btn"
                                  title={
                                    esActivo
                                      ? "Desactivar usuario"
                                      : "Activar usuario"
                                  }
                                  disabled={procesando}
                                  onClick={() =>
                                    cambiarEstado(item)
                                  }
                                >
                                  <FaToggleOn />
                                  {esActivo
                                    ? "Desactivar"
                                    : "Activar"}
                                </button>
                              )}

                              {/* ELIMINAR */}

                              {acciones.puedeEliminar === true && (
                                <button
                                  type="button"
                                  className="app-btn app-btn-danger gestion-usuarios-action-btn"
                                  title="Eliminar usuario"
                                  disabled={procesando}
                                  onClick={() =>
                                    eliminarUsuario(item)
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
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================================================
          MODAL DE EDICIÓN
          ================================================ */}

      <ModalBase
        isOpen={isEditModalOpen}
        title={
          modoEdicion === "celular"
            ? "Editar celular"
            : "Editar usuario"
        }
        onClose={cerrarModalEdicion}
        footer={
          <>
            <button
              type="button"
              className="app-btn app-btn-cancel"
              onClick={cerrarModalEdicion}
              disabled={guardandoEdicion}
            >
              Cancelar
            </button>

            <button
              type="submit"
              form="editar-usuario-form"
              className="app-btn app-btn-primary"
              disabled={
                guardandoEdicion ||
                (modoEdicion === "completo" && cargandoRoles)
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
            key={`${usuarioEdicion.id_usuario}-${modoEdicion}`}
            id="editar-usuario-form"
            className="system-form"
            onSubmit={guardarEdicion}
          >
            <div className="system-form-grid">

              {/* NOMBRE - SOLO EDICIÓN COMPLETA */}

              {modoEdicion === "completo" && (
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
                    defaultValue={usuarioEdicion.nombre}
                    disabled={guardandoEdicion}
                    required
                  />
                </div>
              )}

              {/* CORREO - SOLO EDICIÓN COMPLETA */}

              {modoEdicion === "completo" && (
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
                    defaultValue={usuarioEdicion.correo}
                    disabled={guardandoEdicion}
                    required
                  />
                </div>
              )}

              {/* CELULAR */}

              <div className="system-form-group system-form-full">
                <label
                  className="system-form-label"
                  htmlFor="editar-usuario-telefono"
                >
                  Número de celular
                  {modoEdicion === "celular" && (
                    <span className="system-form-required">
                      *
                    </span>
                  )}
                </label>

                <input
                  id="editar-usuario-telefono"
                  name="telefono"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  className="system-form-control"
                  defaultValue={
                    usuarioEdicion.telefono || ""
                  }
                  placeholder="Ej. 51234567"
                  maxLength={8}
                  minLength={
                    modoEdicion === "celular" ? 8 : undefined
                  }
                  pattern="[345][0-9]{7}"
                  title="Ingrese 8 dígitos. Debe iniciar con 3, 4 o 5."
                  disabled={guardandoEdicion}
                  required={modoEdicion === "celular"}
                  onInput={(event) => {
                    event.currentTarget.value =
                      event.currentTarget.value
                        .replace(/\D/g, "")
                        .slice(0, 8);
                  }}
                />

                <small className="system-form-help">
                  Ingrese un número guatemalteco de 8 dígitos,
                  sin espacios ni código de país.
                </small>
              </div>

              {/* USUARIO Y ROL - SOLO EDICIÓN COMPLETA */}

              {modoEdicion === "completo" && (
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
                      defaultValue={usuarioEdicion.usuario}
                      disabled={guardandoEdicion}
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
                      defaultValue={String(
                        usuarioEdicion.rol_id
                      )}
                      disabled={
                        guardandoEdicion || cargandoRoles
                      }
                      required
                    >
                      {roles.map((rol) => (
                        <option
                          key={rol.id}
                          value={rol.id}
                        >
                          {rol.nombre}
                        </option>
                      ))}
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
