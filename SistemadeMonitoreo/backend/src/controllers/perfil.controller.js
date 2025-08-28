const pool = require("../config/db");
const bcrypt = require("bcrypt");
const xss = require("xss");

// GET Perfil
exports.getPerfil = async (req, res) => {
    try {
        if (!req.user || !req.user.id_usuario) {
            return res.status(401).json({ message: "Usuario no autenticado" });
        }

        const { id_usuario } = req.user;

        const result = await pool.query(
            `SELECT 
          u.id_usuario,
          u.nombre,
          u.correo,
          u.usuario,
          r.nombre AS rol,
          e.nombre AS estado
       FROM usuarios u
       LEFT JOIN roles r ON u.rol_id = r.id
       LEFT JOIN estados_usuario e ON u.estado_id = e.id
       WHERE u.id_usuario = $1
       LIMIT 1`,
            [id_usuario]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        const usuario = result.rows[0];

        res.json({
            id_usuario: usuario.id_usuario,
            nombre: usuario.nombre,
            correo: usuario.correo,
            usuario: usuario.usuario,
            rol: usuario.rol || "Rol no asignado",
            estado: usuario.estado || "Desconocido",
            password: "******" // nunca exponemos la contraseña real
        });
    } catch (err) {
        console.error(" Error obteniendo perfil:", err.message);
        res.status(500).json({ message: "Error interno del servidor" });
    }
};

//  PUT Actualizar Perfil
exports.updatePerfil = async (req, res) => {
    try {
        if (!req.user || !req.user.id_usuario) {
            return res.status(401).json({ message: "Usuario no autenticado" });
        }

        const { id_usuario } = req.user;
        const { nombre, correo, usuario, nueva_contraseña } = req.body;

        //  Sanitización de inputs
        const campos = {
            nombre: nombre ? xss(nombre.trim()) : null,
            correo: correo ? xss(correo.trim()) : null,
            usuario: usuario ? xss(usuario.trim()) : null,
        };

        //  Validación correo
        if (campos.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campos.correo)) {
            return res.status(400).json({ message: "Formato de correo inválido" });
        }

        //  Hash de contraseña si se envía
        let passwordHash = null;
        if (nueva_contraseña) {
            if (nueva_contraseña.length < 8) {
                return res
                    .status(400)
                    .json({ message: "La contraseña debe tener al menos 8 caracteres" });
            }
            passwordHash = await bcrypt.hash(nueva_contraseña, 12);
        }

        //  Construcción dinámica de query
        const updates = [];
        const values = [];
        let idx = 1;

        for (const [key, val] of Object.entries(campos)) {
            if (val) {
                updates.push(`${key} = $${idx++}`);
                values.push(val);
            }
        }

        if (passwordHash) {
            updates.push(`password_hash = $${idx++}`);
            values.push(passwordHash);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: "No se enviaron campos para actualizar" });
        }

        values.push(id_usuario);

        const query = `
      UPDATE usuarios 
      SET ${updates.join(", ")}
      WHERE id_usuario = $${idx}
      RETURNING id_usuario
    `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        //  Obtener rol y estado en la misma respuesta
        const perfilActualizado = await pool.query(
            `SELECT 
          u.id_usuario,
          u.nombre,
          u.correo,
          u.usuario,
          r.nombre AS rol,
          e.nombre AS estado
       FROM usuarios u
       LEFT JOIN roles r ON u.rol_id = r.id
       LEFT JOIN estados_usuario e ON u.estado_id = e.id
       WHERE u.id_usuario = $1
       LIMIT 1`,
            [result.rows[0].id_usuario]
        );

        res.json({
            message: "✅ Perfil actualizado correctamente",
            usuario: perfilActualizado.rows[0]
        });
    } catch (err) {
        console.error("❌ Error actualizando perfil:", err.message);
        res.status(500).json({ message: "Error interno del servidor" });
    }
};