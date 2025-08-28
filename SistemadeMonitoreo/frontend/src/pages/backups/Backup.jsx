import React, { useState } from "react";
import { Card, Form, Button, Row, Col } from "react-bootstrap";
import { FaShieldAlt, FaEnvelope, FaFolderOpen } from "react-icons/fa";
import { showConfirmAlert, showSuccessAlert } from "../../utils/alerts";
import "../../styles/backup.css";

const Backup = () => {
  const [formData, setFormData] = useState({
    nombre: "",
    prioridad: "Media",
    destino: "",
    contrasena: "",
    email: "",
    notificaciones: {
      exito: true,
      errores: true,
      advertencias: false,
    },
  });

  const [errors, setErrors] = useState({});
  const [isEditing, setIsEditing] = useState(true);

  // 🔹 Manejar cambios
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  // 🔹 Manejar selección de carpeta
  const handleFolderSelect = (e) => {
    if (e.target.files.length > 0) {
      // Tomamos el path relativo de la primera carpeta seleccionada
      const folderPath = e.target.files[0].webkitRelativePath.split("/")[0];
      setFormData({ ...formData, destino: folderPath });
      setErrors({ ...errors, destino: "" });
    }
  };

  const handleCheckbox = (e) => {
    const { name, checked } = e.target;
    setFormData({
      ...formData,
      notificaciones: { ...formData.notificaciones, [name]: checked },
    });
  };

  // 🔹 Validaciones
  const validate = () => {
    let newErrors = {};
    if (!formData.nombre.trim()) newErrors.nombre = "El nombre es obligatorio";
    if (!formData.destino.trim())
      newErrors.destino = "La ubicación es obligatoria";
    if (!formData.contrasena.trim())
      newErrors.contrasena = "La contraseña es obligatoria";
    if (!formData.email.trim()) newErrors.email = "El email es obligatorio";
    return newErrors;
  };

  // 🔹 Guardar / Editar
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!isEditing) {
      // Habilitamos edición
      setIsEditing(true);
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    showConfirmAlert(
      "¿Desea guardar la configuración del backup?",
      "Los datos serán almacenados en el sistema.",
      () => {
        console.log("Backup configurado:", formData);
        setIsEditing(false); // bloqueamos campos
        showSuccessAlert("Guardado correctamente");
      },
      () => {
        console.log("Usuario canceló el guardado.");
      }
    );
  };

  return (
    <div className="p-4 backup-container">
      {/* 🔹 Encabezado */}
      <div className="mb-4 text-center">
        <h3 className="fw-bold d-flex justify-content-center align-items-center">
          <FaShieldAlt className="me-2 text-primary" />
          Configuración de Backup
        </h3>
        <p className="text-muted">
          Protege tu información con configuraciones personalizadas
        </p>
      </div>

      <Form onSubmit={handleSubmit}>
        <Row>
          {/* Sección 1 */}
          <Col md={6}>
            <Card className="mb-4 shadow-sm border-0 section-card">
              <Card.Body>
                <h5 className="section-title">
                  <span className="section-number">1</span> Configuración Básica
                </h5>
                <hr />
                <Form.Group className="mb-3">
                  <Form.Label>Nombre del Backup *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Ej: Backup_Sistemas_2025"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={errors.nombre ? "is-invalid" : ""}
                  />
                  {errors.nombre && (
                    <div className="invalid-feedback">{errors.nombre}</div>
                  )}
                </Form.Group>

                <Form.Group>
                  <Form.Label>Prioridad del Backup</Form.Label>
                  <div className="d-flex gap-3 mt-2">
                    {["Baja", "Media", "Alta"].map((nivel) => (
                      <Form.Check
                        key={nivel}
                        type="radio"
                        name="prioridad"
                        label={nivel}
                        value={nivel}
                        checked={formData.prioridad === nivel}
                        onChange={handleChange}
                        disabled={!isEditing}
                      />
                    ))}
                  </div>
                </Form.Group>
              </Card.Body>
            </Card>
          </Col>

          {/* Sección 2 */}
          <Col md={6}>
            <Card className="mb-4 shadow-sm border-0 section-card">
              <Card.Body>
                <h5 className="section-title">
                  <span className="section-number">2</span> Destino del Backup
                </h5>
                <hr />
                <Form.Group>
                  <Form.Label>
                    <FaFolderOpen className="me-2" /> Ubicación de destino *
                  </Form.Label>
                  <div className="d-flex align-items-center gap-3">
                    <Form.Control
                      type="text"
                      placeholder="Seleccione una carpeta..."
                      value={formData.destino}
                      readOnly
                      disabled
                      className={errors.destino ? "is-invalid" : ""}
                    />
                    <Form.Control
                      type="file"
                      webkitdirectory="true"
                      directory=""
                      multiple
                      onChange={handleFolderSelect}
                      disabled={!isEditing}
                    />
                  </div>
                  {errors.destino && (
                    <div className="invalid-feedback d-block">
                      {errors.destino}
                    </div>
                  )}
                </Form.Group>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row>
          {/* Sección 3 */}
          <Col md={6}>
            <Card className="mb-4 shadow-sm border-0 section-card">
              <Card.Body>
                <h5 className="section-title">
                  <span className="section-number">3</span> Seguridad
                </h5>
                <hr />
                <Form.Group>
                  <Form.Label>Contraseña de encriptación *</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Ingrese una contraseña segura"
                    name="contrasena"
                    value={formData.contrasena}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={errors.contrasena ? "is-invalid" : ""}
                  />
                  {errors.contrasena && (
                    <div className="invalid-feedback">{errors.contrasena}</div>
                  )}
                </Form.Group>
              </Card.Body>
            </Card>
          </Col>

          {/* Sección 4 */}
          <Col md={6}>
            <Card className="mb-4 shadow-sm border-0 section-card">
              <Card.Body>
                <h5 className="section-title">
                  <span className="section-number">4</span> Notificaciones
                </h5>
                <hr />
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FaEnvelope className="me-2" /> Email para notificaciones *
                  </Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="admin@empresa.com"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={errors.email ? "is-invalid" : ""}
                  />
                  {errors.email && (
                    <div className="invalid-feedback">{errors.email}</div>
                  )}
                </Form.Group>

                <Form.Label>Notificar en caso de:</Form.Label>
                <div className="d-flex flex-wrap gap-3 mt-2">
                  <Form.Check
                    type="checkbox"
                    label="Backup exitoso"
                    name="exito"
                    checked={formData.notificaciones.exito}
                    onChange={handleCheckbox}
                    disabled={!isEditing}
                  />
                  <Form.Check
                    type="checkbox"
                    label="Errores"
                    name="errores"
                    checked={formData.notificaciones.errores}
                    onChange={handleCheckbox}
                    disabled={!isEditing}
                  />
                  <Form.Check
                    type="checkbox"
                    label="Advertencias"
                    name="advertencias"
                    checked={formData.notificaciones.advertencias}
                    onChange={handleCheckbox}
                    disabled={!isEditing}
                  />
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Botón Guardar/Editar */}
        <div className="text-center">
          <Button type="submit" variant={isEditing ? "success" : "primary"}>
            {isEditing ? "Guardar Configuración" : "Editar Configuración"}
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default Backup;
