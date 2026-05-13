export function verifySharedSecretHeader(request: Request, expectedSecret: string, authKey = "x-trellis-secret") {
  if (!expectedSecret) {
    return true;
  }

  const header = request.headers.get(authKey);
  const querySecret = new URL(request.url).searchParams.get("secret");
  return header === expectedSecret || querySecret === expectedSecret;
}

