import React, { useState, useEffect } from "react";
import { FaUser, FaEdit, FaSave } from "react-icons/fa";
import axios from "axios";
import {
  showDynamicConfirm,
  showErrorAlert,
  showSuccessAlert,
} from "../../utils/alerts";
import "../../styles/perfil.css";

const MiPerfil = () => {
  const [editable, setEditable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState({
    nombre: "",
    correo: "",
    usuario: "",
    contrasena: "********", // siempre bloqueada
    rol: "",
    estado: "",
  });

  //Cargar perfil desde backend
  useEffect(() => {
    const fetchPerfil = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("/api/perfil", {
          headers: { Authorization: `Bearer ${token}` },
        });

        setUserData((prev) => ({
          ...prev,
          ...res.data,
          contrasena: "********", // nunca mostramos real
        }));
      } catch (err) {
        console.error("Error al cargar perfil:", err);
        showErrorAlert("No se pudo cargar el perfil");
      } finally {
        setLoading(false);
      }
    };
    fetchPerfil();
  }, []);

  // Guardar cambios
  const handleEdit = () => {
    if (editable) {
      showDynamicConfirm(
        "editar",
        async () => {
          try {
            const token = localStorage.getItem("token");
            await axios.put(
              "/api/perfil",
              {
                nombre: userData.nombre,
                correo: userData.correo,
                usuario: userData.usuario,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            showSuccessAlert("Perfil actualizado correctamente");
            setEditable(false);
          } catch (err) {
            console.error("Error actualizando perfil:", err);
            showErrorAlert("No se pudo actualizar el perfil");
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

  if (loading) return <p>Cargando perfil...</p>;

  return (
    <div className="perfil-container">
      {/* Tarjeta izquierda */}
      <div className="perfil-card">
        <h5 className="perfil-title">
          <FaUser className="me-2" />
          Mi Perfil
        </h5>

        <div className="perfil-form">
          {/* Nombre y Correo */}
          <div className="form-row">
            <div className="form-group">
              <label>Nombre</label>
              <input
                type="text"
                value={userData.nombre || ""}
                readOnly={!editable}
                className="form-control"
                onChange={(e) =>
                  setUserData({ ...userData, nombre: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Correo</label>
              <input
                type="email"
                value={userData.correo || ""}
                readOnly={!editable}
                className="form-control"
                onChange={(e) =>
                  setUserData({ ...userData, correo: e.target.value })
                }
              />
            </div>
          </div>

          {/* Usuario y Contraseña */}
          <div className="form-row">
            <div className="form-group">
              <label>Usuario</label>
              <input
                type="text"
                value={userData.usuario || ""}
                readOnly={!editable}
                className="form-control"
                onChange={(e) =>
                  setUserData({ ...userData, usuario: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Contraseña</label>
              <input
                type="password"
                value={userData.contrasena}
                readOnly
                className="form-control"
              />
            </div>
          </div>

          {/* Botón Editar/Guardar */}
          <button
            className={`btn-edit ${editable ? "guardar" : "editar"}`}
            onClick={handleEdit}
          >
            {editable ? (
              <>
                <FaSave className="me-1" /> Guardar
              </>
            ) : (
              <>
                <FaEdit className="me-1" /> Editar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tarjeta derecha */}
      <div className="perfil-summary">
        <div className="avatar">
          <FaUser size={60} />
        </div>
        <h5>{userData.usuario}</h5>
        <hr />
        <p>{userData.rol || "Rol no asignado"}</p>
        <span
          className={`estado ${
            userData.estado === "Activo" ? "activo" : "inactivo"
          }`}
        >
          ● {userData.estado || "Desconocido"}
        </span>
      </div>
    </div>
  );
};

export default MiPerfil;
