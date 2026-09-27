import React, {
  useState,
  useEffect,
} from "react";

import {
  FaUser,
  FaLock,
} from "react-icons/fa";

import {
  toast,
} from "react-toastify";

import {
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";

import axios from "axios";

import "../styles/login.css";


// ======================================================
// CONFIGURACIÓN DE ENTORNO
// ======================================================
//
// La URL viene del .env del FRONTEND.
//
// VITE_API_URL
//
// No colocar localhost ni direcciones
// de producción directamente en el código.
// ======================================================

const API_URL = (
  import.meta.env.VITE_API_URL || ""
)
  .trim()
  .replace(/\/+$/, "");


// ======================================================
// DESTINO DESDE WHATSAPP
// ======================================================

const RUTA_CONSULTA =
  "/consulta-niveles";

const RUTA_DASHBOARD =
  "/dashboard";

const CLAVE_DESTINO =
  "bioinfeccioso_post_login";


// ======================================================
// COMPONENTE
// ======================================================

const Login = () => {

  // ====================================================
  // FORMULARIO
  // ====================================================

  const [
    usuario,
    setUsuario,
  ] = useState("");

  const [
    contrasena,
    setContrasena,
  ] = useState("");


  // ====================================================
  // BLOQUEO TEMPORAL
  // ====================================================

  const [
    tiempoRestante,
    setTiempoRestante,
  ] = useState(0);


  // ====================================================
  // EVITAR DOBLE ENVÍO
  // ====================================================

  const [
    procesando,
    setProcesando,
  ] = useState(false);


  // ====================================================
  // NAVEGACIÓN
  // ====================================================

  const navigate =
    useNavigate();

  const location =
    useLocation();


  // ====================================================
  // CONTADOR REGRESIVO DE BLOQUEO
  // ====================================================

  useEffect(() => {

    let intervalo;


    if (
      tiempoRestante > 0
    ) {

      intervalo = setInterval(
        () => {

          setTiempoRestante(
            (prev) =>
              prev > 0
                ? prev - 1
                : 0
          );

        },
        1000
      );

    }


    return () => {

      clearInterval(
        intervalo
      );

    };

  }, [
    tiempoRestante,
  ]);


  // ====================================================
  // FORMATEAR SEGUNDOS A MM:SS
  // ====================================================

  const formatearTiempo = (
    segundos
  ) => {

    const minutos =
      Math.floor(
        segundos / 60
      );

    const seg =
      segundos % 60;


    return `${minutos}:${
      seg < 10
        ? `0${seg}`
        : seg
    }`;

  };


  // ====================================================
  // IDENTIFICAR INGRESO DESDE WHATSAPP
  // ====================================================
  //
  // ProtectedRoute puede conservar el destino:
  //
  // 1. En location.state.from.
  // 2. En sessionStorage.
  //
  // Solo aceptamos nuestra ruta conocida.
  // No redirigimos hacia URLs arbitrarias.
  // ====================================================

  const vieneDeConsultaNiveles = () => {

    const destinoEstado =
      location.state?.from;

    const destinoGuardado =
      sessionStorage.getItem(
        CLAVE_DESTINO
      );


    return (
      destinoEstado === RUTA_CONSULTA ||
      destinoGuardado === RUTA_CONSULTA
    );

  };


  // ====================================================
  // CONSERVAR DESTINO DURANTE CAMBIO DE CONTRASEÑA
  // ====================================================
  //
  // El cambio obligatorio o la reconfirmación
  // no deben hacer que se pierda el enlace
  // de WhatsApp.
  // ====================================================

  const conservarDestinoPendiente = () => {

    if (
      vieneDeConsultaNiveles()
    ) {

      sessionStorage.setItem(
        CLAVE_DESTINO,
        RUTA_CONSULTA
      );

    }

  };


  // ====================================================
  // REDIRIGIR A CAMBIO DE CONTRASEÑA
  // ====================================================
  //
  // Se reutiliza tanto si el backend devuelve:
  //
  // - requiereCambio en una respuesta exitosa;
  // - requiereCambio dentro de una respuesta de error.
  //
  // Evitamos duplicar esa lógica.
  // ====================================================

  const redirigirACambioContrasena = (
    data
  ) => {

    conservarDestinoPendiente();


    if (
      data?.token
    ) {

      localStorage.setItem(
        "token",
        data.token
      );

    }


    const ruta =
      data?.tipo ===
      "reconfirmacion"

        ? "/reconfirmar-contrasena"

        : "/contrasena-obligatoria";


    navigate(
      ruta,
      {

        state: {
          usuario,
        },

      }
    );

  };


  // ====================================================
  // LOGIN
  // ====================================================

  const handleSubmit = async (
    e
  ) => {

    e.preventDefault();


    // ==================================================
    // EVITAR SOLICITUDES SIMULTÁNEAS
    // ==================================================

    if (
      procesando ||
      tiempoRestante > 0
    ) {

      return;

    }


    // ==================================================
    // VALIDAR CAMPOS
    // ==================================================

    if (
      !usuario.trim() ||
      !contrasena
    ) {

      toast.error(
        "Por favor complete todos los campos."
      );

      return;

    }


    // ==================================================
    // VALIDAR CONFIGURACIÓN
    // ==================================================

    if (
      !API_URL
    ) {

      toast.error(
        "No se ha configurado la conexión con el servidor."
      );

      return;

    }


    setProcesando(true);


    try {

      // ==================================================
      // AUTENTICAR EN EL BACKEND
      // ==================================================
      //
      // Se conserva la petición directa de Login.
      //
      // apiClient se utiliza para las peticiones
      // autenticadas del resto del sistema.
      // ==================================================

      const res =
        await axios.post(

          `${API_URL}/api/auth/login`,

          {
            usuario,
            contrasena,
          }

        );


      // ==================================================
      // CAMBIO DE CONTRASEÑA REQUERIDO
      // ==================================================

      if (
        res.data?.requiereCambio
      ) {

        redirigirACambioContrasena(
          res.data
        );

        return;

      }


      // ==================================================
      // VALIDAR TOKEN RECIBIDO
      // ==================================================

      if (
        !res.data?.token
      ) {

        toast.error(
          "El servidor no devolvió una sesión válida. Intente nuevamente."
        );

        return;

      }


      // ==================================================
      // GUARDAR SESIÓN
      // ==================================================

      localStorage.setItem(
        "token",
        res.data.token
      );


      // ==================================================
      // DETERMINAR DESTINO
      // ==================================================
      //
      // Ingreso normal:
      //
      // /dashboard
      //
      // Ingreso desde WhatsApp:
      //
      // /consulta-niveles
      // ==================================================

      const destino =
        vieneDeConsultaNiveles()

          ? RUTA_CONSULTA

          : RUTA_DASHBOARD;


      // ==================================================
      // LIMPIAR DESTINO PENDIENTE
      // ==================================================
      //
      // Ya tenemos sesión válida y sabemos
      // a qué pantalla ingresar.
      // ==================================================

      sessionStorage.removeItem(
        CLAVE_DESTINO
      );


      // ==================================================
      // MENSAJE DE ÉXITO
      // ==================================================

      toast.success(
        "Inicio de sesión exitoso."
      );


      // ==================================================
      // INGRESAR AL SISTEMA
      // ==================================================

      navigate(
        destino,
        {
          replace: true,
        }
      );


    } catch (err) {

      // ==================================================
      // FALLBACK CAMBIO DE CONTRASEÑA
      // ==================================================
      //
      // Algunos flujos del backend pueden
      // informar requiereCambio mediante
      // una respuesta de error HTTP.
      // ==================================================

      if (
        err?.response?.data
          ?.requiereCambio
      ) {

        redirigirACambioContrasena(
          err.response.data
        );

        return;

      }


      // ==================================================
      // ERRORES DEL BACKEND
      // ==================================================

      if (
        err?.response?.data
      ) {

        const data =
          err.response.data;


        const mensaje =
          data.message ||
          "No fue posible iniciar sesión.";


        toast.error(
          mensaje
        );


        // ==============================================
        // BLOQUEO TEMPORAL
        // ==============================================

        if (
          data.bloqueado_hasta
        ) {

          const finBloqueo =
            new Date(
              data.bloqueado_hasta
            ).getTime();


          const ahora =
            Date.now();


          if (
            Number.isFinite(
              finBloqueo
            )
          ) {

            const diffSegundos =
              Math.max(

                Math.floor(
                  (
                    finBloqueo -
                    ahora
                  ) / 1000
                ),

                0

              );


            setTiempoRestante(
              diffSegundos
            );

          }

        }


      } else {

        // ==============================================
        // ERROR DE CONEXIÓN
        // ==============================================

        toast.error(
          "No fue posible conectar con el servidor. Intente nuevamente."
        );

      }


    } finally {

      setProcesando(
        false
      );

    }

  };


  // ======================================================
  // VISTA
  // ======================================================

  return (

    <main className="login-page">

      <section className="login-container">


        {/* ============================================
            IDENTIDAD DEL SISTEMA
        ============================================ */}

        <div className="brand-section">

          <h1 className="brand-title">

            Sistema de Monitoreo
            Bioinfeccioso

          </h1>

        </div>


        {/* ============================================
            FORMULARIO
        ============================================ */}

        <div className="login-form-section">

          <h2 className="login-title">

            Iniciar Sesión

          </h2>


          <form

            className="system-form"

            onSubmit={
              handleSubmit
            }

          >


            {/* ========================================
                USUARIO
            ======================================== */}

            <div className="system-form-group">

              <label

                htmlFor="usuario"

                className="system-form-label login-field-label"

              >

                <FaUser />

                <span>

                  Usuario

                </span>

              </label>


              <input

                type="text"

                id="usuario"

                className="system-form-control"

                placeholder="Ingrese su usuario"

                value={
                  usuario
                }

                onChange={
                  (e) =>
                    setUsuario(
                      e.target.value
                    )
                }

                required

                disabled={
                  tiempoRestante > 0 ||
                  procesando
                }

                autoComplete="username"

              />

            </div>


            {/* ========================================
                CONTRASEÑA
            ======================================== */}

            <div className="system-form-group">

              <label

                htmlFor="contrasena"

                className="system-form-label login-field-label"

              >

                <FaLock />

                <span>

                  Contraseña

                </span>

              </label>


              <input

                type="password"

                id="contrasena"

                className="system-form-control"

                placeholder="Ingrese su contraseña"

                value={
                  contrasena
                }

                onChange={
                  (e) =>
                    setContrasena(
                      e.target.value
                    )
                }

                required

                disabled={
                  tiempoRestante > 0 ||
                  procesando
                }

                autoComplete="current-password"

              />

            </div>


            {/* ========================================
                BLOQUEO TEMPORAL
            ======================================== */}

            {tiempoRestante > 0 && (

              <div

                className="
                  system-alert
                  system-alert-danger
                  login-lockout-alert
                "

                role="alert"

              >

                Intente de nuevo en{" "}

                <strong>

                  {formatearTiempo(
                    tiempoRestante
                  )}

                </strong>

              </div>

            )}


            {/* ========================================
                ACCIÓN PRINCIPAL
            ======================================== */}

            <button

              type="submit"

              className="
                app-btn
                app-btn-primary
                app-btn-block
                btn-login
              "

              disabled={
                tiempoRestante > 0 ||
                procesando
              }

            >

              {procesando
                ? "Iniciando sesión..."
                : "Iniciar Sesión"}

            </button>


            {/* ========================================
                RECUPERAR CONTRASEÑA
            ======================================== */}

            <Link

              to="/recuperar-contrasena"

              className="forgot-password"

            >

              ¿Olvidaste la contraseña?

            </Link>


          </form>

        </div>

      </section>

    </main>

  );

};


export default Login;