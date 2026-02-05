import { AxiosError, AxiosResponse } from "axios";
import axios from "axios";

/**
 * Enhanced error type for Entity API operations that preserves axios error information
 * while providing a more user-friendly interface for error handling.
 */
export class EntityApiError extends Error {
  public readonly method: string;
  public readonly url: string;
  public readonly status?: number;
  public readonly statusText?: string;
  public readonly response?: AxiosResponse;
  public readonly request?: any;
  public readonly data?: any;
  public readonly originalError: AxiosError | Error;

  constructor(
    method: string,
    url: string,
    originalError: AxiosError | Error,
    message?: string
  ) {
    // Create a descriptive error message
    const errorMessage =
      message || EntityApiError.createErrorMessage(method, url, originalError);
    super(errorMessage);

    this.name = "EntityApiError";
    this.method = method.toUpperCase();
    this.url = url;
    this.originalError = originalError;

    // Extract axios-specific properties if available
    if (
      originalError &&
      "isAxiosError" in originalError &&
      originalError.isAxiosError
    ) {
      const axiosError = originalError as AxiosError;
      this.status = axiosError.response?.status;
      this.statusText = axiosError.response?.statusText;
      this.response = axiosError.response;
      this.request = axiosError.request;
      this.data = axiosError.response?.data;
    }
  }

  /**
   * Creates a user-friendly error message from the original error
   */
  private static createErrorMessage(
    method: string,
    url: string,
    error: AxiosError | Error
  ): string {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const serverMessage = error.response?.data?.message;

      if (serverMessage) {
        return `${method.toUpperCase()} ${url} failed: ${serverMessage}`;
      } else if (status && statusText) {
        return `${method.toUpperCase()} ${url} failed: ${status} ${statusText}`;
      } else {
        return `${method.toUpperCase()} ${url} failed: ${error.message}`;
      }
    } else {
      return `${method.toUpperCase()} ${url} failed: ${error.message}`;
    }
  }

  /**
   * Type guard to check if an unknown error is an EntityApiError
   */
  public static isEntityApiError(error: unknown): error is EntityApiError {
    return error instanceof EntityApiError;
  }

  /**
   * Returns true if this error represents a client error (4xx status codes)
   */
  public isClientError(): boolean {
    return this.status !== undefined && this.status >= 400 && this.status < 500;
  }

  /**
   * Returns true if this error represents a server error (5xx status codes)
   */
  public isServerError(): boolean {
    return this.status !== undefined && this.status >= 500;
  }

  /**
   * Returns true if this error represents a network error (no response received)
   */
  public isNetworkError(): boolean {
    return this.status === undefined && "isAxiosError" in this.originalError;
  }

  /**
   * Returns true if this error represents a service unavailable error (503)
   */
  public isServiceUnavailable(): boolean {
    return this.status === 503;
  }
}
