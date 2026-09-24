import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { Sequelize, QueryTypes } from "sequelize";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

// Conexión a la base de datos
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: false,
    dialectOptions: {
      multipleStatements: true,
    },
  }
);

async function probarConexion() {
  try {
    await sequelize.authenticate();
    console.log("Conexión a la base de datos exitosa");
  } catch (error) {
    console.error("Error al conectar a la base de datos:", error.message);
  }
}

probarConexion();

// Rutas
app.get("/", (req, res) => {
  return res.send("PA API");
});

app.get("/health", async (req, res) => {
  try {
    await sequelize.query("SELECT 1", { type: QueryTypes.SELECT });
    return res.json({ status: "ok", db: "ok" });
  } catch (error) {
    return res.status(500).json({ status: "error", db: error.message });
  }
});

app.listen(PORT, (error) => {
  if (!error) console.log("Escuchando en puerto: " + PORT);
  else console.log("Ocurrió un error: ", error);
});
