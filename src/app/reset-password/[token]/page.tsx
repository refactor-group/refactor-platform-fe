"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

import { cn } from "@/components/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Icons } from "@/components/ui/icons"
import { ResetPasswordForm } from "@/components/ui/password-reset/reset-password-form"
import { PasswordResetApi } from "@/lib/api/password-reset"
import { useAuthStore } from "@/lib/providers/auth-store-provider"
import { useLogoutUser } from "@/lib/hooks/use-logout-user"
import { siteConfig } from "@/site.config"
import {
    isInvalidOrExpiredTokenError,
    isPasswordResetValidationError,
    type PasswordResetPageState,
} from "@/types/password-reset"
import { EntityApiError } from "@/types/general"

const INVALID_OR_EXPIRED_MESSAGE =
    "This reset link is invalid or has expired. Please request a new one."

function getValidateErrorMessage(error: unknown): string {
    if (isInvalidOrExpiredTokenError(error)) {
        return INVALID_OR_EXPIRED_MESSAGE
    }
    if (error instanceof EntityApiError) {
        if (error.isServerError()) {
            return "Something went wrong. Please try again later."
        }
        if (error.isNetworkError()) {
            return "Unable to connect. Please check your connection and try again."
        }
    }
    return "An unexpected error occurred. Please try again."
}

function getCompleteErrorMessage(error: unknown): string {
    if (isInvalidOrExpiredTokenError(error)) {
        return INVALID_OR_EXPIRED_MESSAGE
    }
    if (isPasswordResetValidationError(error)) {
        // BE returns a specific per-rule message (e.g. "Password must be at
        // least 12 characters"). Surface it verbatim so the user sees the
        // exact policy. Falls back to a generic if the body shape is unexpected.
        if (error instanceof EntityApiError) {
            const message = (error.data as { message?: unknown })?.message
            if (typeof message === "string" && message.length > 0) {
                return message
            }
        }
        return "Your password does not meet requirements. Please try again."
    }
    return getValidateErrorMessage(error)
}

export default function ResetPasswordPage() {
    const params = useParams<{ token: string }>()
    const token = params.token
    const isLoggedIn = useAuthStore((state) => state.isLoggedIn)
    const logoutUser = useLogoutUser()

    const [pageState, setPageState] = useState<PasswordResetPageState>({
        kind: "validating",
    })
    const [formError, setFormError] = useState("")

    useEffect(() => {
        PasswordResetApi.validate(token)
            .then((data) => {
                setPageState({
                    kind: "ready",
                    firstName: data.first_name,
                    lastName: data.last_name,
                })
            })
            .catch((error) => {
                setPageState({
                    kind: "error",
                    message: getValidateErrorMessage(error),
                })
            })
    }, [token])

    const handleSubmit = async (password: string, confirmPassword: string) => {
        if (pageState.kind !== "ready") return

        const { firstName, lastName } = pageState
        setPageState({ kind: "submitting", firstName, lastName })
        setFormError("")

        try {
            await PasswordResetApi.complete({
                token,
                password,
                confirm_password: confirmPassword,
            })

            // Force-logout: if the user was signed in (e.g. helped someone else
            // reset their password on a shared device, or reset their own
            // account while still signed in), clear local state so the post-
            // reset "Sign in" CTA lands them on a clean login.
            if (isLoggedIn) {
                await logoutUser()
            }

            setPageState({ kind: "success" })
        } catch (error) {
            if (isInvalidOrExpiredTokenError(error)) {
                setPageState({
                    kind: "error",
                    message: getCompleteErrorMessage(error),
                })
                return
            }
            setFormError(getCompleteErrorMessage(error))
            setPageState({ kind: "ready", firstName, lastName })
        }
    }

    const greeting =
        pageState.kind === "ready" || pageState.kind === "submitting"
            ? `Hi ${pageState.firstName}, set a new password below.`
            : ""

    return (
        <main>
            <div className="container relative h-[800px] flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
                {/* Column 1 — Branding */}
                <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
                    <div className="absolute inset-0 bg-zinc-900" />
                    <div className="relative z-20 flex items-center text-lg font-medium">
                        <Link
                            href="https://www.refactorgroup.com"
                            className="mr-2 flex items-center space-x-2"
                        >
                            <div
                                className={cn(
                                    buttonVariants({ variant: "ghost" }),
                                    "w-9 px-0"
                                )}
                            >
                                <Icons.refactor_logo className="h-7 w-7" />
                                <span className="sr-only">Refactor</span>
                            </div>
                        </Link>
                        {siteConfig.name}
                    </div>
                    <div className="relative z-20 mt-auto">
                        <blockquote className="space-y-2">
                            <p className="text-lg">{siteConfig.description}</p>
                        </blockquote>
                    </div>
                </div>

                {/* Column 2 — Content */}
                <div className="mx-auto flex flex-col justify-center mt-16 space-y-8 sm:w-96 lg:mt-0">
                    <div className="flex flex-col space-y-2 text-center">
                        <div className="flex items-center justify-center space-x-2">
                            <Link
                                href="https://www.refactorgroup.com"
                                className="flex items-center lg:hidden"
                            >
                                <div
                                    className={cn(
                                        buttonVariants({ variant: "ghost" }),
                                        "w-10 px-0"
                                    )}
                                >
                                    <Icons.refactor_logo className="h-7 w-7" />
                                    <span className="sr-only">Refactor</span>
                                </div>
                            </Link>
                            <h1 className="text-2xl font-semibold tracking-tight">
                                Reset Your Password
                            </h1>
                        </div>
                    </div>

                    {pageState.kind === "validating" && (
                        <div className="flex flex-col items-center space-y-4">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                            <p className="text-sm text-muted-foreground">
                                Validating your reset link...
                            </p>
                        </div>
                    )}

                    {(pageState.kind === "ready" || pageState.kind === "submitting") && (
                        <>
                            <p className="text-center text-sm text-muted-foreground">
                                {greeting}
                            </p>
                            <ResetPasswordForm
                                onSubmit={handleSubmit}
                                isSubmitting={pageState.kind === "submitting"}
                                error={formError}
                            />
                        </>
                    )}

                    {pageState.kind === "success" && (
                        <div className="flex flex-col items-center space-y-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                                <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-center text-sm text-muted-foreground">
                                Your password has been updated. Please sign in with your new password.
                            </p>
                            <Link
                                href="/"
                                className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                            >
                                Go to Sign In
                            </Link>
                        </div>
                    )}

                    {pageState.kind === "error" && (
                        <div className="flex flex-col items-center space-y-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <p className="text-center text-sm text-muted-foreground">
                                {pageState.message}
                            </p>
                            <Link
                                href="/forgot-password"
                                className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                            >
                                Request a new reset link
                            </Link>
                            <Link
                                href="/"
                                className="text-sm text-muted-foreground underline hover:text-foreground"
                            >
                                Back to sign in
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}
