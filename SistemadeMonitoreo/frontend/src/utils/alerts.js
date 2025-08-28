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
 *Alerta de éxito
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
 * Alerta de error
 */
export const showErrorAlert = (message) => {
  Swal.fire({
    title: "Error",
    text: message,
    icon: "error",
    confirmButtonColor: "#d33",
  });
};
