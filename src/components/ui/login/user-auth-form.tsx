"use client";

import * as React from "react";

import { cn } from "@/components/lib/utils";
import { useUserSessionMutation } from "@/lib/api/user-sessions";
import { EntityApiError } from "@/lib/api/entity-api";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  defaultUserSession,
  UserSession,
  userSessionToString,
} from "@/types/user-session";

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}

export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
  const { login } = useAuthStore((action) => action);
  const { redirectAfterLogin } = useAuthRedirect();

  const { create: createUserSession } = useUserSessionMutation();

  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [email, setEmail] = React.useState<string>("");
  const [password, setPassword] = React.useState<string>("");
  const [error, setError] = React.useState<string>("");

  async function loginUserSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    setIsLoading(true);

    const userSession: UserSession = {
      ...defaultUserSession(),
      email,
      password,
    };

    await createUserSession(userSession)
      .then((userSession: UserSession) => {
        // Create a new session in the auth store
        login(userSession.id, userSession);
        setIsLoading(false);
        // Redirect to intended destination or fallback to dashboard
        redirectAfterLogin("/dashboard");
      })
      .catch((err) => {
        setIsLoading(false);
        console.error("Login failed:", err);

        // Enhanced error handling with EntityApiError
        if (err instanceof EntityApiError) {
          // Handle specific HTTP status codes for better UX
          if (err.status === 401) {
            setError("Invalid email or password. Please try again.");
          } else if (err.status === 429) {
            setError(
              "Too many login attempts. Please wait before trying again."
            );
          } else if (err.isServerError()) {
            setError("Server error occurred. Please try again later.");
          } else if (err.isNetworkError()) {
            setError(
              "Network error. Please check your connection and try again."
            );
          } else {
            setError(err.message);
          }
        } else {
          setError(err.message || "An unexpected error occurred");
        }
      });
  }

  const updateEmail = (value: string) => {
    setEmail(value);
    setError("");
  };

  const updatePassword = (value: string) => {
    setPassword(value);
    setError("");
  };

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <form onSubmit={loginUserSubmit}>
        <div className="grid gap-2">
          <div className="grid gap-1">
            <Label className="sr-only" htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              name="email"
              placeholder="name@example.com"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              required
              disabled={isLoading}
              onChange={(e) => updateEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label className="sr-only" htmlFor="password">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              name="password"
              autoCapitalize="none"
              autoComplete="current-password"
              autoCorrect="off"
              required
              disabled={isLoading}
              onChange={(e) => updatePassword(e.target.value)}
            />
          </div>
          <Button disabled={isLoading}>
            {isLoading && (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            )}
            Sign In with Email
          </Button>
          <p className="text-center text-sm font-semibold text-red-500 text-muted-foreground">
            {error}
          </p>
        </div>
      </form>
      {/* <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>
      <Button variant="outline" type="button" disabled={isLoading}>
        {isLoading ? (
          <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Icons.gitHub className="mr-2 h-4 w-4" />
        )}{" "}
        GitHub
      </Button> */}
    </div>
  );
}
