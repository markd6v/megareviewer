const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error(`${name} is not set`);
  return value;
};

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required("DATABASE_URL"),
  paymentsUrl: process.env.PAYMENTS_URL ?? "https://api.payments.example.com",
  paymentsApiKey: required("PAYMENTS_API_KEY"),
};
