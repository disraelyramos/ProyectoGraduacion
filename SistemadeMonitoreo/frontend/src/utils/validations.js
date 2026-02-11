/**
 * 🔹 Validador genérico reutilizable
 * @param {Object} data - Datos del formulario (key: value)
 * @param {Object} rules - Reglas de validación (key: [reglas])
 * @param {Object} labels - (Opcional) Etiquetas bonitas por campo (key: label)
 * @returns {Object} errors - Errores encontrados
 */
export const validateForm = (data, rules, labels = {}) => {
  let errors = {};

  for (const field in rules) {
    const value = data[field] ? data[field].toString().trim() : "";
    const fieldRules = rules[field];

    // ✅ Si no hay label, usa el nombre del field (compatibilidad total)
    const label = labels[field] || field;

    for (const rule of fieldRules) {
      // Requerido
      if (rule === "required" && !value) {
        errors[field] = `El campo ${label} es obligatorio`;
        break;
      }

      // Longitud mínima
      if (rule?.minLength && value.length < rule.minLength) {
        errors[field] = `El campo ${label} debe tener al menos ${rule.minLength} caracteres`;
        break;
      }

      // Longitud máxima
      if (rule?.maxLength && value.length > rule.maxLength) {
        errors[field] = `El campo ${label} no puede exceder ${rule.maxLength} caracteres`;
        break;
      }

      // Email
      if (rule === "email") {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(value)) {
          errors[field] = `El campo ${label} debe ser un correo válido`;
          break;
        }
      }

      // Fecha válida
      if (rule === "date") {
        const fecha = new Date(value);
        if (isNaN(fecha.getTime())) {
          errors[field] = `El campo ${label} no contiene una fecha válida`;
          break;
        }
      }

      // Fecha no futura
      if (rule === "noFutureDate") {
        const fecha = new Date(value);
        const hoy = new Date();
        if (fecha > hoy) {
          errors[field] = `El campo ${label} no puede ser una fecha futura`;
          break;
        }
      }

      // Solo letras
      if (rule === "onlyLetters") {
        const regex = /^[A-Za-zÁÉÍÓÚáéíóúñÑ\s]+$/;
        if (!regex.test(value)) {
          errors[field] = `El campo ${label} solo puede contener letras`;
          break;
        }
      }

      // No solo números
      if (rule === "noOnlyNumbers") {
        if (/^\d+$/.test(value)) {
          errors[field] = `El campo ${label} no puede ser solo números`;
          break;
        }
      }

      // Contraseña fuerte
      if (rule === "strongPassword") {
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
        if (!regex.test(value)) {
          errors[field] =
            "La contraseña debe tener mínimo 8 caracteres, incluir mayúscula, minúscula, número y símbolo";
          break;
        }
      }
    }
  }

  return errors;
};
