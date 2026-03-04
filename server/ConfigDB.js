// ConfigDB.ts
// ATENÇÃO: Este arquivo contém configurações sensíveis do banco de dados.
// Ele deve ser executado e acessado apenas no lado do servidor (Backend).
// NÃO importe este arquivo em componentes do React (Front-end) para evitar exposição de credenciais.

export const ConfigDB = {
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'nome_do_banco',
  user: process.env.DB_USER || 'usuario_db',
  password: process.env.DB_PASSWORD || 'senha_db',
  port: parseInt(process.env.DB_PORT || '3306', 10),
};

export default ConfigDB;
