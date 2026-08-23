import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

/**
 * =====================================================
 * ALERTA DE CONFIRMACIÓN PARAMETRIZABLE
 * =====================================================
 */
export const showConfirmAlert = (
  title,
  text,
  onConfirm,
  onCancel
) => {
  return Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí",
    cancelButtonText: "No",
    reverseButtons: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
  }).then(async (result) => {
    if (
      result.isConfirmed &&
      typeof onConfirm === "function"
    ) {
      return await onConfirm();
    }

    if (
      result.dismiss === Swal.DismissReason.cancel &&
      typeof onCancel === "function"
    ) {
      return await onCancel();
    }

    return result;
  });
};

/**
 * =====================================================
 * ALERTA DINÁMICA SEGÚN ACCIÓN
 * =====================================================
 */
export const showDynamicConfirm = (
  accion,
  onConfirm,
  onCancel
) => {
  const config = {
    crear: {
      title: "¿Desea guardar este registro?",
      text: "El nuevo elemento será almacenado.",
      icon: "question",
    },

    editar: {
      title: "¿Desea actualizar este registro?",
      text: "Los cambios no se podrán deshacer.",
      icon: "warning",
    },

    eliminar: {
      title: "¿Desea eliminar este registro?",
      text: "Esta acción no se podrá revertir.",
      icon: "error",
    },

    activar: {
      title: "¿Desea activar este elemento?",
      text: "El elemento quedará activo inmediatamente.",
      icon: "info",
    },

    desactivar: {
      title: "¿Desea desactivar este elemento?",
      text: "El elemento quedará inactivo.",
      icon: "info",
    },
  };

  const {
    title,
    text,
    icon,
  } = config[accion] || config.crear;

  return Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText: "Sí",
    cancelButtonText: "No",
    reverseButtons: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
  }).then(async (result) => {
    if (
      result.isConfirmed &&
      typeof onConfirm === "function"
    ) {
      return await onConfirm();
    }

    if (
      result.dismiss === Swal.DismissReason.cancel &&
      typeof onCancel === "function"
    ) {
      return await onCancel();
    }

    return result;
  });
};

/**
 * =====================================================
 * ÉXITO
 * =====================================================
 */
export const showSuccessAlert = (message) => {
  return Swal.fire({
    title: "¡Éxito!",
    text: message,
    icon: "success",
    confirmButtonText: "Aceptar",
    confirmButtonColor: "#3085d6",
  });
};

/**
 * =====================================================
 * ERROR
 * =====================================================
 */
export const showErrorAlert = (message) => {
  return Swal.fire({
    title: "Error",
    text: message,
    icon: "error",
    confirmButtonText: "Aceptar",
    confirmButtonColor: "#d33",
  });
};

/**
 * =====================================================
 * TOAST
 * =====================================================
 *
 * Se conserva porque otros módulos pueden utilizarlo.
 *
 * No lo usaremos para las advertencias del flujo
 * de pesaje/recolección.
 */
export const showToast = (
  message,
  icon = "info"
) => {
  return Swal.fire({
    toast: true,
    position: "top-end",
    icon,
    title: message,
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
  });
};

/**
 * =====================================================
 * ERROR DEL BACKEND
 * =====================================================
 */
export const showBackendErrorModal = (
  message =
    "Ocurrió un error inesperado. Intente nuevamente."
) => {
  return Swal.fire({
    title: "Error",
    text: message,
    icon: "error",
    confirmButtonText: "Aceptar",
    confirmButtonColor: "#d33",
  });
};

/**
 * =====================================================
 * INFORMACIÓN
 * =====================================================
 */
export const showInfoAlert = (
  message,
  title = "Información"
) => {
  return Swal.fire({
    title,
    text: message,
    icon: "info",
    confirmButtonText: "Aceptar",
    confirmButtonColor: "#3085d6",
  });
};

/**
 * =====================================================
 * PROCESO DE PESAJE EN CURSO
 * =====================================================
 *
 * Exclusiva para el flujo de pesaje/recolección.
 *
 * El archivo de alertas NO sabe cómo cancelar
 * ni cómo recuperar el proceso.
 *
 * Únicamente ejecuta los callbacks que recibe
 * desde NuevoRegistro.
 */
export const showProcesoEnCursoAlert = async ({
  message =
    "Tiene un proceso de pesaje en curso. ¿Qué desea hacer?",

  proceso = null,

  onContinue,
  onCancel,
}) => {
  const result = await Swal.fire({
    title: "Proceso en curso",
    text: message,
    icon: "warning",

    showCancelButton: true,

    confirmButtonText:
      "Continuar proceso",

    cancelButtonText:
      "Cancelar proceso",

    reverseButtons: true,

    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",

    /**
     * No debe cerrarse accidentalmente.
     * El usuario debe decidir qué hacer.
     */
    allowOutsideClick: false,
    allowEscapeKey: false,
  });

  /**
   * CONTINUAR
   */
  if (result.isConfirmed) {
    if (typeof onContinue === "function") {
      return await onContinue(proceso);
    }

    return result;
  }

  /**
   * CANCELAR
   */
  if (
    result.dismiss ===
    Swal.DismissReason.cancel
  ) {
    if (typeof onCancel === "function") {
      return await onCancel(proceso);
    }

    return result;
  }

  return result;
};

/**
 * =====================================================
 * MANEJADOR CENTRAL DE RESPUESTAS DEL BACKEND
 * =====================================================
 *
 * Las vistas pueden mandar aquí:
 *
 * status
 * data
 *
 * y esta función decide qué Modal mostrar.
 *
 * De esa manera no colocamos if/else de alertas
 * repetidos por todas las vistas.
 */
export const showBackendAlert = async ({
  status,
  data,
  onContinueProcess,
  onCancelProcess,
}) => {
  const statusCode =
    Number(status) || 500;

  const message =
    data?.message ||
    "Ocurrió un inconveniente al procesar la solicitud.";

  const codigo =
    data?.codigo || null;

  /**
   * ================================================
   * PROCESO EN CURSO
   * ================================================
   */
  if (
    codigo === "PROCESO_EN_CURSO" &&
    data?.requiere_decision === true
  ) {
    return showProcesoEnCursoAlert({
      message,

      proceso:
        data?.proceso || null,

      onContinue:
        onContinueProcess,

      onCancel:
        onCancelProcess,
    });
  }

  /**
   * ================================================
   * ERROR INTERNO
   * ================================================
   */
  if (statusCode >= 500) {
    return showBackendErrorModal(
      message
    );
  }

  /**
   * ================================================
   * AUTENTICACIÓN / PERMISOS
   * ================================================
   */
  if (
    statusCode === 401 ||
    statusCode === 403
  ) {
    return Swal.fire({
      title: "Acceso no autorizado",
      text: message,
      icon: "warning",
      confirmButtonText: "Aceptar",
      confirmButtonColor: "#3085d6",
    });
  }

  /**
   * ================================================
   * NO ENCONTRADO
   * ================================================
   */
  if (statusCode === 404) {
    return showInfoAlert(
      message
    );
  }

  /**
   * ================================================
   * VALIDACIONES / CONFLICTOS
   * ================================================
   *
   * 400
   * 409
   * etc.
   */
  return Swal.fire({
    title: "Advertencia",
    text: message,
    icon: "warning",
    confirmButtonText: "Aceptar",
    confirmButtonColor: "#3085d6",
  });
};