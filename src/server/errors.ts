export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400, public fields?: Record<string, string>) { super(message); }
}
export const notFound = () => new AppError("NOT_FOUND", "This workspace or task could not be found.", 404);
export const conflict = () => new AppError("REVISION_CONFLICT", "This item changed in another tab. Reload the latest version before saving your draft again.", 409);
