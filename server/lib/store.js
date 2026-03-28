const config = require("../config");

const useFileStore =
  process.env.STORE_BACKEND === "file" ||
  !config.dbHost ||
  !config.dbName ||
  !config.dbUser ||
  !config.dbPassword;

module.exports = useFileStore
  ? require("./store-file")
  : require("./store-mysql");
