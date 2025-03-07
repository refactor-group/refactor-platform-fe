import { siteConfig } from "@/site.config";
import axios from "axios";

export namespace EntityApi {
  interface ApiResponse<T> {
    status_code: number;
    data: T;
  }

  // Generic fetcher function
  const fetcher = async <T>(url: string, config?: any): Promise<T> =>
    axios
      .get<ApiResponse<T>>(url, {
        withCredentials: true,
        timeout: 5000,
        headers: {
          "X-Version": siteConfig.env.backendApiVersion,
        },
        ...config,
      })
      .then((res) => res.data.data);

  // Type-safe mutation function for manipulating Organization data
  const mutationFn = async <T, R>(
    method: "post" | "put" | "delete",
    url: string,
    data?: T
  ): Promise<R> => {
    const config = {
      withCredentials: true,
      timeout: 5000,
      headers: {
        "X-Version": siteConfig.env.backendApiVersion,
      },
    };

    let response;
    if (method === "delete") {
      response = await axios.delete<ApiResponse<R>>(url, config);
    } else if (method === "put" && data) {
      response = await axios.put<ApiResponse<R>>(url, data, config);
    } else if (data) {
      response = await axios.post<ApiResponse<R>>(url, data, config);
    } else {
      throw new Error("Invalid method or missing data");
    }

    return response.data.data;
  };

  export const listFn = async <R>(url: string, params: any): Promise<R[]> => {
    return fetcher<R[]>(url, params);
  };

  export const getFn = async <R>(url: string): Promise<R> => {
    return fetcher<R>(url);
  };

  export const createFn = async <T, R>(url: string, entity: T): Promise<R> => {
    return mutationFn<T, R>("post", url, entity);
  };

  export const updateFn = async <T, R>(url: string, entity: T): Promise<R> => {
    return mutationFn<T, R>("put", url, entity);
  };

  export const deleteFn = async <T, R>(url: string): Promise<R> => {
    return mutationFn<T, R>("put", url);
  };
}
