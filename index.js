import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { QueryTypes } from "sequelize";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { empresas } from "./empresas.js";
import { getConnection, getEmpresa } from "./helpers/getConnection.js";
import { authAdmin } from "./middlewares/authAdmin.js";
import { authToken } from "./middlewares/authToken.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

// Rutas
app.get("/", (req, res) => {
  return res.send("PA API");
});

app.get("/health", async (req, res) => {
  try {
    await getConnection(empresas[0].db).authenticate();
    return res.json({ status: "ok", db: "ok" });
  } catch (error) {
    return res.status(500).json({ status: "error", db: error.message });
  }
});

app.post("/getOpByTel", authToken, async (req, res) => {
  const { empresa, nro_tel } = req.body;

  if (!empresa || !nro_tel) {
    return res
      .status(400)
      .json({ error: "Faltan parámetros: empresa y nro_tel son obligatorios" });
  }

  const datosEmpresa = getEmpresa(empresa);
  if (!datosEmpresa) {
    return res.status(404).json({ error: `Empresa ${empresa} no encontrada` });
  }

  try {
    const sequelize = getConnection(datosEmpresa.db);
    // El número puede estar en cualquiera de los 4 campos de teléfono
    const operaciones = await sequelize.query(
      `SELECT NroDocumento, Grupo, Orden FROM operaciones
       WHERE :nro_tel IN (Telefonos, Telefonos2, Telefonos3, Telefonos4)`,
      {
        replacements: { nro_tel },
        type: QueryTypes.SELECT,
      }
    );
    return res.json(operaciones);
  } catch (error) {
    console.error(`Error en getOpByTel (${datosEmpresa.db}):`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/postObs", authToken, async (req, res) => {
  const { empresa, grupo, orden, observacion, usuario, marca } = req.body;
  let operacion;

  if (!empresa) {
    return res
      .status(400)
      .json({ error: "Faltan parámetros: empresa es obligatorio" });
  }

  const datosEmpresa = getEmpresa(empresa);
  if (!datosEmpresa) {
    return res.status(404).json({ error: `Empresa ${empresa} no encontrada` });
  }


  try {
    const sequelize = getConnection(datosEmpresa.db);
    //busco numero de operacion
    const resultNroOperacion = await sequelize.query(
      `SELECT Codigo FROM operaciones WHERE Grupo = :grupo AND Orden = :orden`,{
        replacements: {grupo, orden},
        type: QueryTypes.SELECT
      }
    )
    if(!resultNroOperacion.length) return res.status(404).json({ error: `Operacion no encontrada para grupo: ${grupo} y orden: ${orden}`});
    operacion = resultNroOperacion[0]["Codigo"]
    console.log(operacion)
    await sequelize.query(
      `INSERT INTO observaciones (marca, observacion, operacion, UserID) 
      VALUES (:marca, :observacion, :operacion, :usuario)`,
      {
        replacements: { marca, observacion, operacion, usuario },
        type: QueryTypes.INSERT,
      }
    ); 
     return res.status(200).json({message: "Observación cargada exitosamente"}); 
  } catch (error) {
    console.error(`Error en getOpByTel (${datosEmpresa.db}):`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/createUser", authAdmin, async (req, res) => {
  const { email, password, nombre } = req.body;

  if (!email || !password || !nombre) {
    return res
      .status(400)
      .json({ error: "Faltan parámetros: email, password y nombre son obligatorios" });
  }

  try {
    const sequelize = getConnection("pa7_comun");

    const existente = await sequelize.query(
      "SELECT id FROM usuarios_api_pa6 WHERE email = :email",
      { replacements: { email }, type: QueryTypes.SELECT }
    );
    if (existente.length) {
      return res.status(409).json({ error: `Ya existe un usuario con el email ${email}` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [id] = await sequelize.query(
      "INSERT INTO usuarios_api_pa6 (email, password, nombre) VALUES (:email, :password, :nombre)",
      {
        replacements: { email, password: hashedPassword, nombre },
        type: QueryTypes.INSERT,
      }
    );

    return res.status(201).json({ message: "Usuario creado correctamente", id, email, nombre });
  } catch (error) {
    console.error("Error en createUser:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/getToken", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Faltan parámetros: email y password son obligatorios" });
  }

  try {
    const usuarios = await getConnection("pa7_comun").query(
      "SELECT id, email, password FROM usuarios_api_pa6 WHERE email = :email",
      { replacements: { email }, type: QueryTypes.SELECT }
    );

    const usuario = usuarios[0];
    const passwordOk = usuario && (await bcrypt.compare(password, usuario.password));
    if (!passwordOk) {
      return res.status(401).json({ error: "Email o contraseña incorrectos" });
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email },
      process.env.TOKEN_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({ token, expiresIn: "24h" });
  } catch (error) {
    console.error("Error en getToken:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, (error) => {
  if (!error) console.log("Escuchando en puerto: " + PORT);
  else console.log("Ocurrió un error: ", error);
});
