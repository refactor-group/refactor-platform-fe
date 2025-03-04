// This must always reflect the Rust struct on the backend
// entity::jwt
export interface Jwt {
  token: string;
  sub: string;
}

export function parseJwt(data: any): Jwt {
  if (!isJwt(data)) {
    throw new Error("Invalid Jwt data");
  }

  return {
    token: data.token,
    sub: data.sub,
  };
}

export function isJwt(value: unknown): value is Jwt {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "token" in value && "sub" in value;
}
