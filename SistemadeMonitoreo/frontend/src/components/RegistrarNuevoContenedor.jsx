import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Row, Col } from "react-bootstrap";
import { validateForm } from "../utils/validations";
import {
    showDynamicConfirm,
    showSuccessAlert,
    showErrorAlert,
} from "../utils/alerts";
import axios from "axios";

const RegistrarNuevoContenedor = ({
    show,
    handleClose,
    handleSave,
    modoEdicion = false,
    contenedorEditar = null,
}) => {
    // ------------------ Estados ------------------
    const [codigo, setCodigo] = useState("");
    const [ubicacion, setUbicacion] = useState("");
    const [tipoResiduo, setTipoResiduo] = useState("");
    const [estado, setEstado] = useState("");
    const [capacidadMaxLitros, setCapacidadMaxLitros] = useState("");
    const [capacidadMaxLb, setCapacidadMaxLb] = useState("");
    const [errors, setErrors] = useState({});

    // Selects dinámicos
    const [ubicaciones, setUbicaciones] = useState([]);
    const [tiposResiduo, setTiposResiduo] = useState([]);
    const [estadosContenedor, setEstadosContenedor] = useState([]);

    // Reglas de validación
    const reglasContenedor = {
        ubicacion: ["required"],
        tipoResiduo: ["required"],
        estado: ["required"],
        capacidadMaxLitros: ["required"],
        capacidadMaxLb: ["required"],
    };

    // ------------------ Funciones auxiliares ------------------
    const limpiarFormulario = () => {
        setCodigo("");
        setUbicacion("");
        setTipoResiduo("");
        setEstado("");
        setCapacidadMaxLitros("");
        setCapacidadMaxLb("");
        setErrors({});
    };

    const fetchSelects = async () => {
        try {
            const token = localStorage.getItem("token");
            const headers = { Authorization: `Bearer ${token}` };

            const [resUbicaciones, resTipos, resEstados] = await Promise.all([
                axios.get("/api/ubicaciones", { headers }),
                axios.get("/api/tipos-residuo", { headers }),
                axios.get("/api/estados-contenedor", { headers }),
            ]);

            setUbicaciones(resUbicaciones.data);
            setTiposResiduo(resTipos.data);
            setEstadosContenedor(resEstados.data);
        } catch (error) {
            console.error("Error cargando selects:", error);
            showErrorAlert("No se pudieron cargar los datos del servidor.");
        }
    };

    const guardarContenedor = async () => {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        const payload = {
            ubicacion,
            tipoResiduo,
            estado,
            capacidadMaxLitros,
            capacidadMaxLb,
        };

        if (modoEdicion && contenedorEditar?.id_contenedor) {
            return axios.put(
                `/api/contenedores/${contenedorEditar.id_contenedor}`,
                payload,
                { headers }
            );
        }

        return axios.post("/api/contenedores", payload, { headers });
    };

    const validarCapacidades = () => {
        const litros = Number(capacidadMaxLitros);
        const libras = Number(capacidadMaxLb);
        const nuevosErrores = {};

        if (!Number.isFinite(litros) || litros <= 0) {
            nuevosErrores.capacidadMaxLitros =
                "La capacidad máxima en litros debe ser mayor a 0";
        }

        if (!Number.isFinite(libras) || libras <= 0) {
            nuevosErrores.capacidadMaxLb =
                "La capacidad máxima en libras debe ser mayor a 0";
        }

        return nuevosErrores;
    };

    // ------------------ Effects ------------------
    useEffect(() => {
        if (show) fetchSelects();
    }, [show]);

    useEffect(() => {
        if (modoEdicion && contenedorEditar) {
            setCodigo(contenedorEditar.codigo || "");
            setUbicacion(contenedorEditar.id_ubicacion || "");
            setTipoResiduo(
                contenedorEditar.id_tipo_residuo ||
                contenedorEditar.tipo_residuo_id ||
                ""
            );
            setEstado(
                contenedorEditar.id_estado_contenedor ||
                contenedorEditar.estado_id ||
                ""
            );
            setCapacidadMaxLitros(contenedorEditar.capacidad_max_litros || "");
            setCapacidadMaxLb(contenedorEditar.capacidad_max_lb || "");
        } else {
            limpiarFormulario();
        }
    }, [modoEdicion, contenedorEditar, show]);

    // ------------------ Guardar ------------------
    const onSave = () => {
        const newData = {
            codigo,
            ubicacion,
            tipoResiduo,
            estado,
            capacidadMaxLitros,
            capacidadMaxLb,
        };

        const validationErrors = validateForm(newData, reglasContenedor);
        const erroresCapacidad = validarCapacidades();
        const erroresFinales = { ...validationErrors, ...erroresCapacidad };

        if (Object.keys(erroresFinales).length > 0) {
            setErrors(erroresFinales);
            return;
        }

        showDynamicConfirm(
            modoEdicion ? "editar" : "crear",
            async () => {
                try {
                    const response = await guardarContenedor();

                    if (response.data?.success) {
                        showSuccessAlert(
                            modoEdicion
                                ? "El contenedor se actualizó correctamente."
                                : "El contenedor se guardó correctamente."
                        );
                        setErrors({});
                        handleClose();
                        limpiarFormulario();
                        if (handleSave) handleSave();
                    } else {
                        showErrorAlert(
                            response.data?.message || "No se pudo guardar el contenedor."
                        );
                    }
                } catch (error) {
                    console.error("Error guardando contenedor:", error);
                    showErrorAlert("Ocurrió un error en el servidor.");
                }
            },
            () => {
                handleClose();
                limpiarFormulario();
            }
        );
    };

    // ------------------ Render ------------------
    return (
        <Modal
            show={show}
            onHide={() => {
                handleClose();
                limpiarFormulario();
            }}
            centered
            size="lg"
        >
            <Modal.Header closeButton className="bg-dark text-white">
                <Modal.Title>
                    {modoEdicion ? "Editar Contenedor" : "Registrar Nuevo Contenedor"}
                </Modal.Title>
            </Modal.Header>

            <Modal.Body>
                <Form>
                    <Row>
                        {/* Columna izquierda */}
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Código</Form.Label>
                                <Form.Control
                                    type="text"
                                    value={codigo}
                                    placeholder="CNT-"
                                    disabled
                                />
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>Ubicación</Form.Label>
                                <Form.Select
                                    value={ubicacion}
                                    onChange={(e) => setUbicacion(e.target.value)}
                                    isInvalid={!!errors.ubicacion}
                                >
                                    <option value="">Seleccione...</option>
                                    {ubicaciones.map((u) => (
                                        <option key={u.id_ubicacion} value={u.id_ubicacion}>
                                            {u.nombre}
                                        </option>
                                    ))}
                                </Form.Select>
                                {errors.ubicacion && (
                                    <Form.Text className="text-danger small">
                                        {errors.ubicacion}
                                    </Form.Text>
                                )}
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>Capacidad Máxima en Litros</Form.Label>
                                <Form.Control
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={capacidadMaxLitros}
                                    onChange={(e) => setCapacidadMaxLitros(e.target.value)}
                                    placeholder="Ej. 60"
                                    isInvalid={!!errors.capacidadMaxLitros}
                                />
                                {errors.capacidadMaxLitros && (
                                    <Form.Text className="text-danger small">
                                        {errors.capacidadMaxLitros}
                                    </Form.Text>
                                )}
                            </Form.Group>
                        </Col>

                        {/* Columna derecha */}
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Tipo de Residuo</Form.Label>
                                <Form.Select
                                    value={tipoResiduo}
                                    onChange={(e) => setTipoResiduo(e.target.value)}
                                    isInvalid={!!errors.tipoResiduo}
                                >
                                    <option value="">Seleccione...</option>
                                    {tiposResiduo.map((t) => (
                                        <option key={t.id_tipo_residuo} value={t.id_tipo_residuo}>
                                            {t.nombre}
                                        </option>
                                    ))}
                                </Form.Select>
                                {errors.tipoResiduo && (
                                    <Form.Text className="text-danger small">
                                        {errors.tipoResiduo}
                                    </Form.Text>
                                )}
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>Estado</Form.Label>
                                <Form.Select
                                    value={estado}
                                    onChange={(e) => setEstado(e.target.value)}
                                    isInvalid={!!errors.estado}
                                >
                                    <option value="">Seleccione...</option>
                                    {estadosContenedor.map((e) => (
                                        <option
                                            key={e.id_estado_contenedor}
                                            value={e.id_estado_contenedor}
                                        >
                                            {e.nombre}
                                        </option>
                                    ))}
                                </Form.Select>
                                {errors.estado && (
                                    <Form.Text className="text-danger small">
                                        {errors.estado}
                                    </Form.Text>
                                )}
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>Capacidad Máxima en Libras</Form.Label>
                                <Form.Control
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={capacidadMaxLb}
                                    onChange={(e) => setCapacidadMaxLb(e.target.value)}
                                    placeholder="Ej. 80"
                                    isInvalid={!!errors.capacidadMaxLb}
                                />
                                {errors.capacidadMaxLb && (
                                    <Form.Text className="text-danger small">
                                        {errors.capacidadMaxLb}
                                    </Form.Text>
                                )}
                            </Form.Group>
                        </Col>
                    </Row>
                </Form>
            </Modal.Body>

            <Modal.Footer>
                <Button
                    variant="secondary"
                    onClick={() => {
                        handleClose();
                        limpiarFormulario();
                    }}
                >
                    Cancelar
                </Button>
                <Button variant="primary" onClick={onSave}>
                    {modoEdicion ? "Actualizar" : "Guardar"}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default RegistrarNuevoContenedor;