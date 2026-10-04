import React from "react";
import {
  FaUsers,
  FaCube,
  FaPlus,
} from "react-icons/fa";

import "../../styles/administracion.css";

const CrearNuevoUsuario = () => {
  return (
    <section className="system-page administracion-page">
      <div className="system-container">

        <header className="administracion-header">
          <h1 className="system-title">
            Administración
          </h1>

          <p className="system-subtitle">
            Gestiona usuarios y módulos autorizados del sistema.
          </p>
        </header>

        <div className="administracion-grid">

          {/* USUARIOS */}
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
              >
                <FaUsers />
                Gestionar usuarios
              </button>

              <button
                type="button"
                className="app-btn app-btn-cancel app-btn-block administracion-btn-users"
              >
                <FaPlus />
                Nuevo usuario
              </button>
            </div>

          </article>

          {/* MÓDULOS */}
          <article className="system-card administracion-card administracion-card-modules">

            <div className="administracion-icon administracion-icon-modules">
              <FaCube />
            </div>

            <div className="administracion-card-body">
              <h2 className="administracion-card-title">
                Módulos
              </h2>

              <p className="administracion-card-description">
                Registrar y administrar módulos vinculados al sistema.
              </p>
            </div>

            <div className="administracion-actions">
              <button
                type="button"
                className="app-btn app-btn-primary app-btn-block administracion-btn-modules-primary"
              >
                <FaCube />
                Gestionar módulos
              </button>

              <button
                type="button"
                className="app-btn app-btn-cancel app-btn-block administracion-btn-modules"
              >
                <FaPlus />
                Agregar módulo
              </button>
            </div>

          </article>

        </div>
      </div>
    </section>
  );
};

export default CrearNuevoUsuario;