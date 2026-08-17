import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const expressApp = app.getHttpAdapter().getInstance();

  // Initialize and mount adiabatic Express routes
  const fs = require('fs');
  let rootDir = process.cwd();
  while (rootDir && !fs.existsSync(path.join(rootDir, 'adiabatic-cooler-quotation'))) {
    const parent = path.dirname(rootDir);
    if (parent === rootDir) {
      // Fallback relative to __dirname
      rootDir = path.resolve(__dirname, '../../../..');
      break;
    }
    rootDir = parent;
  }
  const { initDb } = require(path.join(rootDir, 'adiabatic-cooler-quotation/backend/db/connection'));
  initDb()
    .then(() => {
      console.log("Adiabatic SQLite database initialized successfully.");
    })
    .catch(err => {
      console.error("Failed to initialize Adiabatic SQLite database:", err);
    });

  // Mount routers
  const adiabaticRouter = express.Router();
  adiabaticRouter.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH,HEAD');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Accept,Authorization,X-User-Role,X-User-Name');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
  adiabaticRouter.use(express.json());
  
  adiabaticRouter.use('/auth', require(path.join(rootDir, 'adiabatic-cooler-quotation/backend/routes/auth')).router);
  adiabaticRouter.use('/users', require(path.join(rootDir, 'adiabatic-cooler-quotation/backend/routes/users')));
  adiabaticRouter.use('/customers', require(path.join(rootDir, 'adiabatic-cooler-quotation/backend/routes/customers')));
  adiabaticRouter.use('/rate-cards', require(path.join(rootDir, 'adiabatic-cooler-quotation/backend/routes/rateCards')));
  adiabaticRouter.use('/pump-models', require(path.join(rootDir, 'adiabatic-cooler-quotation/backend/routes/pumpModels')));
  adiabaticRouter.use('/configs', require(path.join(rootDir, 'adiabatic-cooler-quotation/backend/routes/configs')));
  adiabaticRouter.use('/quotations', require(path.join(rootDir, 'adiabatic-cooler-quotation/backend/routes/quotations')));

  expressApp.use('/api/adiabatic', adiabaticRouter);

  // Serve adiabatic PDFs
  expressApp.use('/pdfs', express.static(path.join(rootDir, 'adiabatic-cooler-quotation/backend/pdfs')));
  
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isLocalOrNetwork = /^(https?:\/\/)?(localhost|\[::1\]|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/i.test(origin);
      if (isLocalOrNetwork) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Accept,Authorization,X-User-Role,X-User-Name',
    credentials: true,
  });

  const port = process.env.PORT ?? 5000;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend server is running on http://localhost:${port}`);
}
bootstrap();
