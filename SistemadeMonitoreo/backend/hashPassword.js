const bcrypt = require('bcrypt');

async function generarHash() {
  try {
    // 👉 Cambia esta contraseña por la que quieras encriptar
    const passwordPlano = 'Iber2025.';
    
    // Número de rondas de sal (más alto = más seguro, pero más lento)
    const saltRounds = 10;

    // Generar hash
    const hash = await bcrypt.hash(passwordPlano, saltRounds);

    console.log('Contraseña en texto plano:', passwordPlano);
    console.log('Hash generado:', hash);
  } catch (error) {
    console.error('Error generando hash:', error);
  }
}

generarHash();
