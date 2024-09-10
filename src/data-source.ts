import { DataSource } from "typeorm"
import fs from 'fs';

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST,
    port: 5432,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: ["src/entity/*.ts"],
    synchronize: true,
    ssl: {
        require: true,
        rejectUnauthorized: true, // Set to true in production with a valid certificate
        ca: fs.readFileSync('certificates/eu-north-1-bundle.pem').toString(),
    }
})