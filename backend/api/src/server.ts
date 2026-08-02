import { createServer } from "http";

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import pinoHttp from "pino-http";

import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import { initSocket } from "./realtime/socket";
import { analyticsRouter } from "./routes/analytics.routes";
import { authRouter } from "./routes/auth.routes";
import { callsRouter } from "./routes/calls.routes";
import { employeesRouter } from "./routes/employees.routes";
import { escalationsRouter } from "./routes/escalations.routes";
import { leadsRouter } from "./routes/leads.routes";

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(pinoHttp());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/calls", callsRouter);
app.use("/api/escalations", escalationsRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/analytics", analyticsRouter);

app.use(errorHandler);

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`CRM API listening on port ${config.port}`);
});
