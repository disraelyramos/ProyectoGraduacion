import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

/**
 * Alerta de confirmación parametrizable
 */
export const showConfirmAlert = (title, text, onConfirm, onCancel) => {
  Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí",
    cancelButtonText: "No",
    reverseButtons: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
  }).then((result) => {
    if (result.isConfirmed && typeof onConfirm === "function") {
      onConfirm();
    } else if (
      result.dismiss === Swal.DismissReason.cancel &&
      typeof onCancel === "function"
    ) {
      onCancel();
    }
  });
};

/**
 * Alerta dinámica según acción
 */
export const showDynamicConfirm = (accion, onConfirm, onCancel) => {
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

  const { title, text, icon } = config[accion] || config["crear"];

  Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText: "Sí",
    cancelButtonText: "No",
    reverseButtons: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
  }).then((result) => {
    if (result.isConfirmed && typeof onConfirm === "function") {
      onConfirm();
    } else if (
      result.dismiss === Swal.DismissReason.cancel &&
      typeof onCancel === "function"
    ) {
      onCancel();
    }
  });
};

/**
 * ✅ Alerta de éxito (modal)
 * Retorna la promesa de SweetAlert para poder usar .then()
 */
export const showSuccessAlert = (message) => {
  return Swal.fire({
    title: "¡Éxito!",
    text: message,
    icon: "success",
    confirmButtonColor: "#3085d6",
  });
};

/**
 * ✅ Alerta de error (modal fuerte)
 * Para errores importantes (backend/operación crítica)
 */
export const showErrorAlert = (message) => {
  return Swal.fire({
    title: "Error",
    text: message,
    icon: "error",
    confirmButtonColor: "#d33",
  });
};

/**
 * ✅ Toast superior (NO bloquea pantalla)
 * Para avisos/errores pequeños y rápidos.
 * icon: "success" | "info" | "warning" | "error"
 */
export const showToast = (message, icon = "info") => {
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
 * ✅ Modal especializado para error de backend
 * Útil para centralizar el mensaje cuando venga 500/403/etc.
 */
export const showBackendErrorModal = (
  message = "Ocurrió un error inesperado. Intente nuevamente."
) => {
  return Swal.fire({
    title: "Error",
    text: message,
    icon: "error",
    confirmButtonColor: "#d33",
  });
};

/**
 * (Opcional) Info modal
 */
export const showInfoAlert = (message, title = "Información") => {
  return Swal.fire({
    title,
    text: message,
    icon: "info",
    confirmButtonColor: "#3085d6",
  });
};
