import { DataSource } from 'typeorm';
import fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: 5432,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [
    'src/services/crm-service/entity/*.ts',
    'src/services/oauth-service/entity/*.ts',
    'src/services/user-service/entity/*.ts',
    'src/services/auth-service/entity/*.ts',
  ],
  synchronize: true,
  ssl: {
    // eslint-disable-next-line
    // @ts-ignore
    require: true,
    rejectUnauthorized: true, // Set to true in production with a valid certificate
    ca: fs.readFileSync('certificates/eu-north-1-bundle.pem').toString(),
  },
});
