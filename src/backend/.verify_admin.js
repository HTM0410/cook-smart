const bcrypt = require('bcryptjs');
const hash = '$2b$10$18JOxcnmEkBNwen5f2QcUu9Ct5rHCyww9xkRs7hjG.1k0NC0JNBjW';
console.log('hash in DB:', hash);
console.log('compare with hoanghhk123:', bcrypt.compareSync('hoanghhk123', hash));
console.log('compare with wrong:', bcrypt.compareSync('wrongpass', hash));