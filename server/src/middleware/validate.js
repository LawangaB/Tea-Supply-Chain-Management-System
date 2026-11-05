/** Parse req.body (or query) with a zod schema; ZodErrors become 400 with field errors. */
export const validate = (schema, source = 'body') => (req, res, next) => {
  const parsed = schema.parse(req[source] ?? {});
  if (source === 'body') req.body = parsed;
  else req.validated = { ...(req.validated || {}), [source]: parsed };
  next();
};
