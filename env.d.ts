declare module "*.css";

/**
 * A minimal shape for dev-only `process.env.NODE_ENV` checks (a React-ecosystem convention:
 * bundlers replace this exact expression at build time), without pulling in full `@types/node`
 * (its ambient globals — `Buffer`, `require`, `__dirname`, … — don't belong in a browser library).
 */
declare const process: { env: { NODE_ENV?: string } };
