import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import authRouter from "./auth";
import eventsRouter from "./events";
import healthRouter from "./health";
import registrationsRouter from "./registrations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(eventsRouter);
router.use(registrationsRouter);
router.use(adminRouter);

export default router;
