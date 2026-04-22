import axios from "axios";
import { siteConfig } from "@/site.config";
import { User } from "@/types/user";
import { MagicLinkSetupRequest } from "@/types/magic-link";

const MAGIC_LINK_BASEURL = `${siteConfig.env.backendServiceURL}/magic-link`;

const axiosConfig = {
  headers: { "X-Version": siteConfig.env.backendApiVersion },
  timeout: 15000,
};

interface ApiResponse<T> {
  status_code: number;
  data: T;
}

export const MagicLinkApi = {
  /**
   * Validates a magic link token.
   * GET /magic-link/validate?token={token}
   */
  validate: async (token: string): Promise<User> => {
    const response = await axios.get<ApiResponse<User>>(
      `${MAGIC_LINK_BASEURL}/validate`,
      { ...axiosConfig, params: { token } }
    );
    return response.data.data;
  },

  /**
   * Completes account setup by setting the user's password.
   * POST /magic-link/complete-setup
   */
  completeSetup: async (payload: MagicLinkSetupRequest): Promise<User> => {
    const response = await axios.post<ApiResponse<User>>(
      `${MAGIC_LINK_BASEURL}/complete-setup`,
      payload,
      axiosConfig
    );
    return response.data.data;
  },
};
