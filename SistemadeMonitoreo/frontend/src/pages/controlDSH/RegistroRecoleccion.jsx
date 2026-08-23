// frontend/src/pages/controlDSH/RegistroRecoleccion.jsx

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Form,
  Button,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
} from "react-bootstrap";

import {
  FaClipboardList,
} from "react-icons/fa";

import apiClient from "../../utils/apiClient";

import {
  showBackendAlert,
  showConfirmAlert,
} from "../../utils/alerts";

import "../../styles/nuevo-registro.css";


// ======================================================
// COMPONENTE
// ======================================================

const RegistroRecoleccion = ({
  onCancel,
  onFinish,
}) => {

  // ====================================================
  // DATOS SOLO PARA PRESENTACIÓN
  // ====================================================
  //
  // Código, responsable y fecha vienen del BACKEND.
  //
  // El frontend NO decide esos valores.
  // ====================================================

  const [
    datosProceso,
    setDatosProceso,
  ] = useState({
    codigo_contenedor: "",
    responsable: "",
    fecha_recoleccion: "",
  });


  // ====================================================
  // CATÁLOGOS
  // ====================================================

  const [
    distritos,
    setDistritos,
  ] = useState([]);


  const [
    empresas,
    setEmpresas,
  ] = useState([]);


  // ====================================================
  // CAMPOS INTRODUCIDOS POR EL USUARIO
  // ====================================================
  //
  // Estos sí deben existir temporalmente en React
  // porque forman parte del formulario.
  //
  // El backend volverá a validarlos todos.
  // ====================================================

  const [
    formData,
    setFormData,
  ] = useState({
    distrito_id: "",
    empresa_id: "",
    numero_recibo: "",
    cantidad_libras_pendientes: "",
    observaciones: "",
  });


  // ====================================================
  // PORCENTAJES CALCULADOS POR BACKEND
  // ====================================================
  //
  // Solamente se muestran.
  //
  // NO se envían posteriormente en Guardar.
  // ====================================================

  const [
    preview,
    setPreview,
  ] = useState({
    porcentaje_pendiente: 0,
    porcentaje_recolectado: 0,
  });


  // ====================================================
  // ESTADOS UI
  // ====================================================

  const [
    loadingInicial,
    setLoadingInicial,
  ] = useState(true);


  const [
    previewLoading,
    setPreviewLoading,
  ] = useState(false);


  const [
    saving,
    setSaving,
  ] = useState(false);


  const [
    errors,
    setErrors,
  ] = useState({});


  // ====================================================
  // PROTECCIONES CONTRA PETICIONES REPETIDAS
  // ====================================================

  const guardarEnCursoRef =
    useRef(false);


  const previewRequestRef =
    useRef(0);


  // ====================================================
  // FORMATEAR FECHA DEL SERVIDOR
  // ====================================================

  const formatearFecha = (
    value
  ) => {

    if (!value) {
      return "";
    }


    const fecha =
      new Date(value);


    if (
      Number.isNaN(
        fecha.getTime()
      )
    ) {

      return String(value);
    }


    const dia =
      String(
        fecha.getDate()
      ).padStart(
        2,
        "0"
      );


    const mes =
      String(
        fecha.getMonth() +
        1
      ).padStart(
        2,
        "0"
      );


    const anio =
      fecha.getFullYear();


    return `${dia}/${mes}/${anio}`;
  };


  // ====================================================
  // CARGAR DATOS DE FOTO 4
  // ====================================================
  //
  // Backend:
  //
  // usuario autenticado
  //        ↓
  // busca EN_PROCESO
  //        ↓
  // verifica que Foto 3 esté calculada
  //        ↓
  // devuelve únicamente información visual.
  // ====================================================

  const cargarDatosProceso =
    useCallback(async () => {

      const res =
        await apiClient.get(
          "/control-dsh/registro-pesaje/recoleccion/datos"
        );


      const data =
        res?.data || {};


      setDatosProceso({
        codigo_contenedor:
          String(
            data
              ?.codigo_contenedor ||
            ""
          ),

        responsable:
          String(
            data
              ?.responsable ||
            ""
          ),

        fecha_recoleccion:
          formatearFecha(
            data
              ?.fecha_servidor
          ),
      });

    }, []);


  // ====================================================
  // CARGAR CATÁLOGOS
  // ====================================================

  const cargarCatalogos =
    useCallback(async () => {

      const [
        resDistritos,
        resEmpresas,
      ] =
        await Promise.all([

          apiClient.get(
            "/control-dsh/catalogos/distritos"
          ),

          apiClient.get(
            "/control-dsh/catalogos/empresas"
          ),
        ]);


      setDistritos(
        Array.isArray(
          resDistritos.data
        )
          ? resDistritos.data
          : []
      );


      setEmpresas(
        Array.isArray(
          resEmpresas.data
        )
          ? resEmpresas.data
          : []
      );

    }, []);


  // ====================================================
  // INICIALIZAR FOTO 4
  // ====================================================

  useEffect(() => {

    let activo =
      true;


    const inicializar =
      async () => {

        setLoadingInicial(
          true
        );


        try {

          await Promise.all([
            cargarDatosProceso(),
            cargarCatalogos(),
          ]);


        } catch (err) {

          if (!activo) {
            return;
          }


          await showBackendAlert({
            status:
              err?.response
                ?.status ||
              500,

            data:
              err?.response
                ?.data ||
              {
                message:
                  "No fue posible cargar la información de recolección.",
              },
          });


        } finally {

          if (activo) {

            setLoadingInicial(
              false
            );
          }
        }
      };


    inicializar();


    return () => {

      activo =
        false;

    };

  }, [
    cargarCatalogos,
    cargarDatosProceso,
  ]);


  // ====================================================
  // VALIDACIONES FRONTEND
  // ====================================================
  //
  // Son solamente UX.
  //
  // El backend debe repetir todas las validaciones.
  // ====================================================

  const validateField = (
    name,
    value
  ) => {

    const valor =
      String(
        value ?? ""
      ).trim();


    const requeridos = [
      "distrito_id",
      "empresa_id",
      "numero_recibo",
      "cantidad_libras_pendientes",
    ];


    if (
      requeridos.includes(
        name
      ) &&
      !valor
    ) {

      return "Este campo es obligatorio";
    }


    // ==================================================
    // IDs
    // ==================================================

    if (
      (
        name ===
          "distrito_id" ||
        name ===
          "empresa_id"
      ) &&
      valor
    ) {

      const numero =
        Number(valor);


      if (
        !Number.isInteger(
          numero
        ) ||
        numero <= 0
      ) {

        return "Seleccione una opción válida";
      }
    }


    // ==================================================
    // RECIBO
    // ==================================================

    if (
      name ===
        "numero_recibo" &&
      valor &&
      !/^[a-zA-Z0-9-]+$/.test(
        valor
      )
    ) {

      return "Use solo letras, números o guiones";
    }


    // ==================================================
    // LIBRAS PENDIENTES
    // ==================================================

    if (
      name ===
        "cantidad_libras_pendientes" &&
      valor
    ) {

      if (
        !/^\d+(\.\d{1,2})?$/.test(
          valor
        )
      ) {

        return "Ej: 0, 10, 10.5";
      }


      const numero =
        Number(valor);


      if (
        !Number.isFinite(
          numero
        ) ||
        numero < 0
      ) {

        return "Cantidad inválida";
      }
    }


    return "";
  };


  // ====================================================
  // CAMBIAR CAMPO
  // ====================================================

  const setField = (
    name,
    value
  ) => {

    setFormData(
      (prev) => ({
        ...prev,
        [name]:
          value,
      })
    );


    setErrors(
      (prev) => ({
        ...prev,

        [name]:
          validateField(
            name,
            value
          ),
      })
    );
  };


  // ====================================================
  // PREVIEW DE PORCENTAJES
  // ====================================================
  //
  // IMPORTANTE:
  //
  // Frontend manda únicamente:
  //
  // cantidad_libras_pendientes
  //
  // Backend obtiene:
  //
  // total_en_libras
  //
  // desde el mismo EN_PROCESO.
  //
  // Backend calcula:
  //
  // % pendiente
  // % recolectado
  //
  // No calculamos ninguno aquí.
  // ====================================================

  useEffect(() => {

    const valor =
      String(
        formData
          .cantidad_libras_pendientes ??
        ""
      ).trim();


    // ==================================================
    // CAMPO VACÍO
    // ==================================================

    if (!valor) {

      setPreview({
        porcentaje_pendiente:
          0,

        porcentaje_recolectado:
          0,
      });


      setPreviewLoading(
        false
      );


      return;
    }


    // ==================================================
    // NO CONSULTAR SI EL CAMPO YA ES INVÁLIDO
    // ==================================================

    const errorCampo =
      validateField(
        "cantidad_libras_pendientes",
        valor
      );


    if (errorCampo) {

      setPreview({
        porcentaje_pendiente:
          0,

        porcentaje_recolectado:
          0,
      });


      return;
    }


    /*
     * Debounce.
     *
     * Evita:
     *
     * 1
     * 10
     * 100
     *
     * = tres peticiones inmediatas.
     *
     * Esperamos a que el usuario deje
     * de escribir durante 500 ms.
     */
    const timer =
      setTimeout(
        async () => {

          const requestId =
            previewRequestRef.current +
            1;


          previewRequestRef.current =
            requestId;


          setPreviewLoading(
            true
          );


          try {

            const res =
              await apiClient.post(
                "/control-dsh/registro-pesaje/recoleccion/preview",

                {
                  cantidad_libras_pendientes:
                    Number(
                      valor
                    ),
                }
              );


            /*
             * Si otra petición más nueva
             * ya ocurrió, ignoramos ésta.
             */
            if (
              requestId !==
              previewRequestRef.current
            ) {
              return;
            }


            setPreview({
              porcentaje_pendiente:
                Number(
                  res.data
                    ?.porcentaje_pendiente ??
                  0
                ),

              porcentaje_recolectado:
                Number(
                  res.data
                    ?.porcentaje_recolectado ??
                  0
                ),
            });


          } catch (err) {

            if (
              requestId !==
              previewRequestRef.current
            ) {
              return;
            }


            setPreview({
              porcentaje_pendiente:
                0,

              porcentaje_recolectado:
                0,
            });


            await showBackendAlert({
              status:
                err?.response
                  ?.status ||
                500,

              data:
                err?.response
                  ?.data ||
                {
                  message:
                    "No fue posible calcular los porcentajes de recolección.",
                },
            });


          } finally {

            if (
              requestId ===
              previewRequestRef.current
            ) {

              setPreviewLoading(
                false
              );
            }
          }

        },

        500
      );


    return () => {

      clearTimeout(
        timer
      );

    };

  }, [
    formData
      .cantidad_libras_pendientes,
  ]);


  // ====================================================
  // CANCELAR
  // ====================================================

  const handleCancelar = () => {

    if (
      saving ||
      guardarEnCursoRef.current
    ) {
      return;
    }


    showConfirmAlert(

      "¿Desea cancelar el proceso?",

      "Si confirma, el proceso será cancelado y deberá iniciar uno nuevo.",


      async () => {

        await onCancel?.();

      },


      null
    );
  };


  // ====================================================
  // VALIDAR FORMULARIO COMPLETO
  // ====================================================

  const validarFormulario = () => {

    const campos = [
      "distrito_id",
      "empresa_id",
      "numero_recibo",
      "cantidad_libras_pendientes",
    ];


    const nuevosErrores =
      {};


    for (
      const campo
      of campos
    ) {

      nuevosErrores[campo] =
        validateField(
          campo,
          formData[campo]
        );
    }


    setErrors(
      nuevosErrores
    );


    return !Object.values(
      nuevosErrores
    ).some(Boolean);
  };


  // ====================================================
  // GUARDAR RECOLECCIÓN
  // ====================================================

  const guardarRecoleccion =
    async () => {

      if (
        guardarEnCursoRef.current ||
        saving
      ) {
        return;
      }


      if (
        !validarFormulario()
      ) {
        return;
      }


      guardarEnCursoRef.current =
        true;


      setSaving(
        true
      );


      try {

        // ===============================================
        // PAYLOAD
        // ===============================================
        //
        // ÚNICAMENTE datos realmente introducidos
        // o seleccionados por el usuario.
        //
        // NO enviamos:
        //
        // proceso_token
        // historial_calculo_id
        // contenedor_id
        // peso total
        // costo
        // porcentaje pendiente
        // porcentaje recolectado
        // responsable
        // fecha
        // lectura_id
        // ===============================================

        const payload = {

          empresa_id:
            Number(
              formData
                .empresa_id
            ),


          distrito_id:
            Number(
              formData
                .distrito_id
            ),


          numero_recibo:
            String(
              formData
                .numero_recibo
            ).trim(),


          cantidad_libras_pendientes:
            Number(
              formData
                .cantidad_libras_pendientes
            ),


          observaciones:
            String(
              formData
                .observaciones ||
              ""
            ).trim() ||
            null,
        };


        await apiClient.post(
          "/control-dsh/registro-pesaje/recoleccion",

          payload
        );


        /*
         * Solo después de confirmación
         * del backend.
         */
        await onFinish?.();


      } catch (err) {

        await showBackendAlert({
          status:
            err?.response
              ?.status ||
            500,

          data:
            err?.response
              ?.data ||
            {
              message:
                "No fue posible guardar la recolección.",
            },
        });


      } finally {

        guardarEnCursoRef.current =
          false;


        setSaving(
          false
        );
      }
    };


  // ====================================================
  // SUBMIT
  // ====================================================

  const handleSubmit = (
    event
  ) => {

    event.preventDefault();


    if (
      saving ||
      guardarEnCursoRef.current
    ) {
      return;
    }


    if (
      !validarFormulario()
    ) {
      return;
    }


    showConfirmAlert(

      "¿Desea guardar la recolección?",

      "Se finalizará el proceso actual.",


      async () => {

        await guardarRecoleccion();

      },


      null
    );
  };


  // ====================================================
  // CARGANDO
  // ====================================================

  if (
    loadingInicial
  ) {

    return (

      <div
        className="
          registro-recoleccion-container
          p-4
        "
      >

        <Card
          className="
            shadow-sm
            border-0
          "
        >

          <Card.Body
            className="
              text-center
              py-5
            "
          >

            <Spinner
              animation="border"
              className="mb-3"
            />


            <div>
              Cargando información de recolección...
            </div>

          </Card.Body>

        </Card>

      </div>
    );
  }


  // ====================================================
  // RENDER
  // ====================================================

  return (

    <div
      className="
        registro-recoleccion-container
        p-4
      "
    >

      <Card
        className="
          shadow-sm
          border-0
        "
      >

        <Card.Body>

          <h4
            className="
              mb-4
              d-flex
              align-items-center
            "
          >

            <FaClipboardList
              className="
                text-primary
                me-2
              "
            />

            Registro de Recolección

          </h4>


          <Form
            onSubmit={
              handleSubmit
            }
          >

            <Row>


              {/* ======================================= */}
              {/* COLUMNA IZQUIERDA                      */}
              {/* ======================================= */}

              <Col md={6}>


                {/* CÓDIGO */}

                <Form.Group
                  className="mb-3"
                >

                  <Form.Label>
                    Código del Contenedor
                  </Form.Label>


                  <Form.Control
                    type="text"

                    value={
                      datosProceso
                        .codigo_contenedor
                    }

                    disabled
                  />

                </Form.Group>


                {/* FECHA */}

                <Form.Group
                  className="mb-3"
                >

                  <Form.Label>
                    Fecha de Recolección
                  </Form.Label>


                  <Form.Control
                    type="text"

                    value={
                      datosProceso
                        .fecha_recoleccion
                    }

                    disabled
                  />

                </Form.Group>


                {/* DISTRITO */}

                <Form.Group
                  className="mb-3"
                >

                  <Form.Label>
                    Distrito
                  </Form.Label>


                  <Form.Select
                    value={
                      formData
                        .distrito_id
                    }

                    disabled={
                      saving
                    }

                    onChange={(
                      event
                    ) =>
                      setField(
                        "distrito_id",
                        event.target.value
                      )
                    }

                    className={
                      errors
                        .distrito_id
                        ? "is-invalid"
                        : ""
                    }
                  >

                    <option value="">
                      Seleccione un distrito
                    </option>


                    {distritos.map(
                      (
                        distrito
                      ) => (

                        <option
                          key={
                            distrito.id
                          }

                          value={
                            String(
                              distrito.id
                            )
                          }
                        >

                          {distrito.nombre}

                        </option>
                      )
                    )}

                  </Form.Select>


                  {errors
                    .distrito_id && (

                    <div
                      className="invalid-feedback"
                    >

                      {
                        errors
                          .distrito_id
                      }

                    </div>
                  )}

                </Form.Group>


                {/* RECIBO */}

                <Form.Group
                  className="mb-3"
                >

                  <Form.Label>
                    Número de Recibo
                  </Form.Label>


                  <Form.Control
                    type="text"

                    value={
                      formData
                        .numero_recibo
                    }

                    disabled={
                      saving
                    }

                    onChange={(
                      event
                    ) =>
                      setField(
                        "numero_recibo",
                        event.target.value
                      )
                    }

                    className={
                      errors
                        .numero_recibo
                        ? "is-invalid"
                        : ""
                    }

                    autoComplete="off"
                  />


                  {errors
                    .numero_recibo && (

                    <div
                      className="invalid-feedback"
                    >

                      {
                        errors
                          .numero_recibo
                      }

                    </div>
                  )}

                </Form.Group>

              </Col>


              {/* ======================================= */}
              {/* COLUMNA DERECHA                        */}
              {/* ======================================= */}

              <Col md={6}>


                {/* RESPONSABLE */}

                <Form.Group
                  className="mb-3"
                >

                  <Form.Label>
                    Responsable
                  </Form.Label>


                  <Form.Control
                    type="text"

                    value={
                      datosProceso
                        .responsable
                    }

                    disabled
                  />

                </Form.Group>


                {/* EMPRESA */}

                <Form.Group
                  className="mb-3"
                >

                  <Form.Label>
                    Empresa Recolectora
                  </Form.Label>


                  <Form.Select
                    value={
                      formData
                        .empresa_id
                    }

                    disabled={
                      saving
                    }

                    onChange={(
                      event
                    ) =>
                      setField(
                        "empresa_id",
                        event.target.value
                      )
                    }

                    className={
                      errors
                        .empresa_id
                        ? "is-invalid"
                        : ""
                    }
                  >

                    <option value="">
                      Seleccione una empresa
                    </option>


                    {empresas.map(
                      (
                        empresa
                      ) => (

                        <option
                          key={
                            empresa.id
                          }

                          value={
                            String(
                              empresa.id
                            )
                          }
                        >

                          {empresa.nombre}

                        </option>
                      )
                    )}

                  </Form.Select>


                  {errors
                    .empresa_id && (

                    <div
                      className="invalid-feedback"
                    >

                      {
                        errors
                          .empresa_id
                      }

                    </div>
                  )}

                </Form.Group>


                {/* LIBRAS PENDIENTES */}

                <Form.Group
                  className="mb-3"
                >

                  <Form.Label>
                    Cantidad en Libras Pendientes
                  </Form.Label>


                  <Form.Control
                    type="text"

                    value={
                      formData
                        .cantidad_libras_pendientes
                    }

                    disabled={
                      saving
                    }

                    onChange={(
                      event
                    ) =>
                      setField(
                        "cantidad_libras_pendientes",
                        event.target.value
                      )
                    }

                    placeholder="Ej: 0, 10, 10.5"

                    className={
                      errors
                        .cantidad_libras_pendientes
                        ? "is-invalid"
                        : ""
                    }

                    inputMode="decimal"

                    autoComplete="off"
                  />


                  {errors
                    .cantidad_libras_pendientes && (

                    <div
                      className="invalid-feedback"
                    >

                      {
                        errors
                          .cantidad_libras_pendientes
                      }

                    </div>
                  )}

                </Form.Group>


                {/* % PENDIENTE */}

                <Form.Group
                  className="mb-3"
                >

                  <Form.Label>
                    % DSH Pendientes de Recolectar
                  </Form.Label>


                  <Form.Control
                    type="text"

                    value={
                      previewLoading
                        ? "Calculando..."

                        : `${Number(
                            preview
                              .porcentaje_pendiente ||
                            0
                          ).toFixed(
                            2
                          )} %`
                    }

                    disabled
                  />

                </Form.Group>


                {/* % RECOLECTADO */}

                <Form.Group
                  className="mb-3"
                >

                  <Form.Label>
                    % DSH Recolectados
                  </Form.Label>


                  <Form.Control
                    type="text"

                    value={
                      previewLoading
                        ? "Calculando..."

                        : `${Number(
                            preview
                              .porcentaje_recolectado ||
                            0
                          ).toFixed(
                            2
                          )} %`
                    }

                    disabled
                  />

                </Form.Group>

              </Col>

            </Row>


            {/* ========================================= */}
            {/* OBSERVACIONES                            */}
            {/* ========================================= */}

            <Row>

              <Col md={12}>

                <Form.Group
                  className="mb-3"
                >

                  <Form.Label>
                    Observaciones (opcional)
                  </Form.Label>


                  <Form.Control
                    as="textarea"

                    rows={3}

                    value={
                      formData
                        .observaciones
                    }

                    disabled={
                      saving
                    }

                    onChange={(
                      event
                    ) =>
                      setField(
                        "observaciones",
                        event.target.value
                      )
                    }
                  />

                </Form.Group>

              </Col>

            </Row>


            {/* ========================================= */}
            {/* BOTONES                                  */}
            {/* ========================================= */}

            <div
              className="
                d-flex
                justify-content-end
                gap-2
              "
            >

              <Button
                type="button"

                variant="secondary"

                onClick={
                  handleCancelar
                }

                disabled={
                  saving
                }
              >

                Cancelar

              </Button>


              <Button
                type="submit"

                variant="success"

                disabled={
                  saving ||
                  previewLoading
                }
              >

                {saving ? (

                  <>

                    <Spinner
                      animation="border"
                      size="sm"
                      className="me-2"
                    />

                    Guardando...

                  </>

                ) : (

                  "Guardar"

                )}

              </Button>

            </div>

          </Form>

        </Card.Body>

      </Card>

    </div>
  );
};


export default RegistroRecoleccion;