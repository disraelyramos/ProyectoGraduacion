import React, {
  useState,
  useEffect,
} from "react";

import {
  FaUser,
  FaEdit,
  FaSave,
} from "react-icons/fa";

import axios from "axios";

import {
  showDynamicConfirm,
  showErrorAlert,
  showSuccessAlert,
} from "../../utils/alerts";

import "../../styles/perfil.css";


/**
 * =====================================================
 * CONFIGURACIÓN DE ENTORNO
 * =====================================================
 *
 * La URL del backend viene del .env del FRONTEND:
 *
 * VITE_API_URL
 */
const API_URL = import.meta.env.VITE_API_URL;


const MiPerfil = () => {

  const [
    editable,
    setEditable,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    userData,
    setUserData,
  ] = useState({
    nombre: "",
    correo: "",
    usuario: "",
    contrasena: "********",
    rol: "",
    estado: "",
  });


  /**
   * =====================================================
   * CARGAR PERFIL
   * =====================================================
   */
  useEffect(() => {

    const fetchPerfil = async () => {

      try {

        const token =
          localStorage.getItem("token");


        const res = await axios.get(
          `${API_URL}/api/perfil`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );


        setUserData((prev) => ({
          ...prev,
          ...res.data,

          // Nunca mostrar contraseña real.
          contrasena: "********",
        }));

      } catch (err) {

        console.error(
          "Error al cargar perfil:",
          err
        );

        showErrorAlert(
          "No se pudo cargar el perfil"
        );

      } finally {

        setLoading(false);
      }
    };


    fetchPerfil();

  }, []);


  /**
   * =====================================================
   * EDITAR / GUARDAR
   * =====================================================
   */
  const handleEdit = () => {

    if (editable) {

      showDynamicConfirm(

        "editar",

        async () => {

          try {

            const token =
              localStorage.getItem("token");


            await axios.put(
              `${API_URL}/api/perfil`,

              {
                nombre:
                  userData.nombre,

                correo:
                  userData.correo,

                usuario:
                  userData.usuario,
              },

              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );


            showSuccessAlert(
              "Perfil actualizado correctamente"
            );


            setEditable(false);

          } catch (err) {

            console.error(
              "Error actualizando perfil:",
              err
            );


            showErrorAlert(
              "No se pudo actualizar el perfil"
            );
          }
        },

        () => {
          setEditable(false);
        }
      );

    } else {

      setEditable(true);
    }
  };


  /**
   * =====================================================
   * CARGANDO
   * =====================================================
   */
  if (loading) {

    return (
      <div className="system-empty-state">
        <p>
          Cargando perfil...
        </p>
      </div>
    );
  }


  /**
   * =====================================================
   * VISTA
   * =====================================================
   */
  return (

    <section className="perfil-container">

      {/* =================================================
          DATOS DEL PERFIL
      ================================================= */}

      <div className="perfil-card system-card">

        <header className="perfil-header">

          <div>
            <h2 className="system-title perfil-title">
              <FaUser />

              <span>
                Mi Perfil
              </span>
            </h2>

            <p className="system-subtitle perfil-description">
              Consulta y actualiza la información
              de tu cuenta.
            </p>
          </div>

        </header>


        <div className="perfil-form system-form">

          {/* ===============================================
              NOMBRE / CORREO
          =============================================== */}

          <div className="system-form-grid">

            <div className="system-form-group">

              <label
                htmlFor="perfil-nombre"
                className="system-form-label"
              >
                Nombre
              </label>

              <input
                id="perfil-nombre"
                type="text"
                value={
                  userData.nombre || ""
                }
                readOnly={!editable}
                className="system-form-control"
                onChange={(e) =>
                  setUserData({
                    ...userData,
                    nombre:
                      e.target.value,
                  })
                }
              />

            </div>


            <div className="system-form-group">

              <label
                htmlFor="perfil-correo"
                className="system-form-label"
              >
                Correo
              </label>

              <input
                id="perfil-correo"
                type="email"
                value={
                  userData.correo || ""
                }
                readOnly={!editable}
                className="system-form-control"
                onChange={(e) =>
                  setUserData({
                    ...userData,
                    correo:
                      e.target.value,
                  })
                }
              />

            </div>

          </div>


          {/* ===============================================
              USUARIO / CONTRASEÑA
          =============================================== */}

          <div className="system-form-grid">

            <div className="system-form-group">

              <label
                htmlFor="perfil-usuario"
                className="system-form-label"
              >
                Usuario
              </label>

              <input
                id="perfil-usuario"
                type="text"
                value={
                  userData.usuario || ""
                }
                readOnly={!editable}
                className="system-form-control"
                onChange={(e) =>
                  setUserData({
                    ...userData,
                    usuario:
                      e.target.value,
                  })
                }
              />

            </div>


            <div className="system-form-group">

              <label
                htmlFor="perfil-contrasena"
                className="system-form-label"
              >
                Contraseña
              </label>

              <input
                id="perfil-contrasena"
                type="password"
                value={
                  userData.contrasena
                }
                readOnly
                className="system-form-control"
              />

              <small className="system-form-help">
                La contraseña no puede visualizarse
                desde esta sección.
              </small>

            </div>

          </div>


          {/* ===============================================
              ACCIÓN
          =============================================== */}

          <div className="system-actions perfil-actions">

            <button
              type="button"
              className={
                editable
                  ? "app-btn app-btn-primary"
                  : "app-btn app-btn-secondary"
              }
              onClick={handleEdit}
            >

              {editable ? (
                <>
                  <FaSave />

                  <span>
                    Guardar
                  </span>
                </>
              ) : (
                <>
                  <FaEdit />

                  <span>
                    Editar
                  </span>
                </>
              )}

            </button>

          </div>

        </div>

      </div>


      {/* =================================================
          RESUMEN DEL USUARIO
      ================================================= */}

      <aside className="perfil-summary system-card">

        <div className="avatar">
          <FaUser />
        </div>


        <div className="perfil-summary-content">

          <h3 className="perfil-summary-user">
            {userData.usuario}
          </h3>


          <p className="perfil-summary-role">
            {userData.rol ||
              "Rol no asignado"}
          </p>


          <span
            className={`system-badge ${
              userData.estado === "Activo"
                ? "system-badge-success"
                : "system-badge-danger"
            }`}
          >
            ●{" "}
            {userData.estado ||
              "Desconocido"}
          </span>

        </div>

      </aside>

    </section>

  );
};


export default MiPerfil;