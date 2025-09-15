const pool = require("../config/db");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const xss = require("xss");
const { enviarCorreo } = require("../services/email.service"); // servicio SendGrid

// Paso 1: Solicitar recuperación de contraseña
exports.solicitarRecuperacion = async (req, res) => {
  try {
    let { identificador } = req.body;

    identificador = xss(identificador);

    if (!identificador) {
      return res.status(400).json({ message: "Debe ingresar usuario o correo" });
    }

    // Buscar usuario ya sea por correo o usuario
    let query, values;
    if (identificador.includes("@")) {
      query = `SELECT id_usuario, usuario, correo FROM usuarios WHERE correo = $1`;
      values = [identificador];
    } else {
      query = `SELECT id_usuario, usuario, correo FROM usuarios WHERE usuario = $1`;
      values = [identificador];
    }

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Usuario o correo no encontrado" });
    }

    const user = result.rows[0];

    // Generar token seguro
    const token = crypto.randomBytes(32).toString("hex");
    const expira = new Date(Date.now() + 10 * 60 * 1000); // expira en 10 minutos

    // Guardar token en BD
    await pool.query(
      `INSERT INTO reset_password_tokens (id_usuario, token, expira) VALUES ($1, $2, $3)`,
      [user.id_usuario, token, expira]
    );

    // Crear enlace seguro
    const link = `http://localhost:5173/reset-password/${token}`;

    // Enviar correo
    await enviarCorreo(
      user.correo,
      "Recuperación de contraseña",
      `
        <h2>Sistema de Monitoreo Bioinfeccioso</h2>
        <p>Hola <b>${user.usuario}</b>, hemos recibido tu solicitud para restablecer tu contraseña.</p>
        <p>Haz clic en el siguiente enlace para continuar:</p>
        <a href="${link}">${link}</a>
        <p> Este enlace expirará en 10 minutos y solo puede usarse una vez.</p>
      `
    );

    return res.json({ message: "Se ha enviado un enlace de recuperación a tu correo" });

  } catch (error) {
    console.error("Error en solicitarRecuperacion:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

// Paso 2: Restablecer contraseña
exports.restablecerContrasena = async (req, res) => {
  try {
    let { token, nuevaContrasena, confirmarContrasena } = req.body;

    token = xss(token);
    nuevaContrasena = xss(nuevaContrasena);
    confirmarContrasena = xss(confirmarContrasena);

    if (!token || !nuevaContrasena || !confirmarContrasena) {
      return res.status(400).json({ message: "Datos incompletos" });
    }

    if (nuevaContrasena !== confirmarContrasena) {
      return res.status(400).json({ message: "Las contraseñas no coinciden" });
    }

    // Buscar token válido + datos del usuario
    const result = await pool.query(
      `SELECT t.id_usuario, t.expira, t.usado, u.usuario, u.password_hash 
       FROM reset_password_tokens t
       JOIN usuarios u ON u.id_usuario = t.id_usuario
       WHERE t.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Token inválido" });
    }

    const tokenData = result.rows[0];

    if (tokenData.usado) {
      return res.status(400).json({ message: "El enlace ya fue utilizado" });
    }

    if (new Date(tokenData.expira) < new Date()) {
      return res.status(400).json({ message: "El enlace ha expirado" });
    }

    // Verificar si la nueva contraseña es igual a la actual
    const mismaContrasena = await bcrypt.compare(nuevaContrasena, tokenData.password_hash);
    if (mismaContrasena) {
      return res.status(400).json({ message: "No puedes reutilizar la misma contraseña anterior" });
    }

    //  Validar que NO coincida con las últimas 5 contraseñas del historial
    const { rows: histRows } = await pool.query(
      `SELECT password_hash
         FROM historial_passwords
        WHERE id_usuario = $1
        ORDER BY fecha_cambio DESC
        LIMIT 5`,
      [tokenData.id_usuario]
    );

    const hashesARevisar = [tokenData.password_hash, ...histRows.map(r => r.password_hash)];
    for (const h of hashesARevisar) {
      const coincide = await bcrypt.compare(nuevaContrasena, h);
      if (coincide) {
        return res.status(400).json({
          message: "La nueva contraseña no puede coincidir con las últimas 5 contraseñas"
        });
      }
    }

    // Hashear nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(nuevaContrasena, salt);

    // Transacción: guardar historial, actualizar usuario y marcar token usado
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Guardar la contraseña anterior en historial
      await client.query(
        `INSERT INTO historial_passwords (id_usuario, password_hash, fecha_cambio)
         VALUES ($1, $2, NOW())`,
        [tokenData.id_usuario, tokenData.password_hash]
      );

      // Actualizar contraseña
      await client.query(
        `UPDATE usuarios
            SET password_hash = $1,
                fecha_ultimo_cambio = NOW(),
                debe_cambiar_password = FALSE
          WHERE id_usuario = $2`,
        [hash, tokenData.id_usuario]
      );

      // Marcar token como usado
      await client.query(
        `UPDATE reset_password_tokens SET usado = TRUE WHERE token = $1`,
        [token]
      );

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      console.error('Error en transacción restablecerContrasena:', txErr);
      return res.status(500).json({ message: "Error al actualizar contraseña" });
    } finally {
      client.release();
    }

    return res.json({ message: "Contraseña restablecida con éxito" });

  } catch (error) {
    console.error("Error en restablecerContrasena:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};
