import axios from "axios";
import { siteConfig } from "@/site.config";
import { EntityApiError } from "@/types/general";
import type {
  PasswordResetCompleteParams,
  PasswordResetRequestParams,
  PasswordResetValidateData,
} from "@/types/password-reset";

const PASSWORD_RESET_BASEURL = `${siteConfig.env.backendServiceURL}/password-reset`;

const axiosConfig = {
  headers: { "X-Version": siteConfig.env.backendApiVersion },
  timeout: 15000,
};

interface ApiResponse<T> {
  status_code: number;
  data: T;
}

function wrap(method: string, path: string, error: unknown): EntityApiError {
  if (error instanceof Error) {
    return new EntityApiError(method, path, error);
  }
  return new EntityApiError(method, path, new Error(String(error)));
}

export const PasswordResetApi = {
  /**
   * Requests a password-reset email.
   * POST /password-reset/request
   * Always returns 200 if accepted (enumeration-safe). 429 on rate-limit.
   */
  request: async (payload: PasswordResetRequestParams): Promise<void> => {
    try {
      await axios.post<ApiResponse<null>>(
        `${PASSWORD_RESET_BASEURL}/request`,
        payload,
        axiosConfig
      );
    } catch (error) {
      throw wrap("POST", "/password-reset/request", error);
    }
  },

  /**
   * Validates a password-reset token without consuming it.
   * GET /password-reset/validate?token={token}
   * Returns sanitized first/last name only — no email or other PII.
   */
  validate: async (token: string): Promise<PasswordResetValidateData> => {
    try {
      const response = await axios.get<ApiResponse<PasswordResetValidateData>>(
        `${PASSWORD_RESET_BASEURL}/validate`,
        { ...axiosConfig, params: { token } }
      );
      return response.data.data;
    } catch (error) {
      throw wrap("GET", "/password-reset/validate", error);
    }
  },

  /**
   * Consumes the token and sets the new password.
   * POST /password-reset/complete
   * Token is deleted atomically. No auto-login — caller must redirect to sign-in.
   */
  complete: async (payload: PasswordResetCompleteParams): Promise<void> => {
    try {
      await axios.post<ApiResponse<unknown>>(
        `${PASSWORD_RESET_BASEURL}/complete`,
        payload,
        axiosConfig
      );
    } catch (error) {
      throw wrap("POST", "/password-reset/complete", error);
    }
  },
};
