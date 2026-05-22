"use client"

import { useState } from "react"
import Link from "next/link"

import { cn } from "@/components/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Icons } from "@/components/ui/icons"
import { ForgotPasswordForm } from "@/components/ui/password-reset/forgot-password-form"
import { PasswordResetApi } from "@/lib/api/password-reset"
import { useAuthStore } from "@/lib/providers/auth-store-provider"
import { siteConfig } from "@/site.config"
import {
    isPasswordResetRateLimitedError,
} from "@/types/password-reset"
import { EntityApiError } from "@/types/general"

type ForgotPasswordState =
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "sent" }

function getErrorMessage(error: unknown): string {
    if (isPasswordResetRateLimitedError(error)) {
        return "Too many password reset requests. Please wait before trying again."
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

export default function ForgotPasswordPage() {
    // Prefill email only when the user is actually signed in. Reading
    // userSession.email unconditionally would surface the empty-string
    // default for logged-out users — a falsy sentinel masquerading as data.
    const isLoggedIn = useAuthStore((state) => state.isLoggedIn)
    const sessionEmail = useAuthStore((state) => state.userSession.email)
    const initialEmail = isLoggedIn ? sessionEmail : undefined

    const [pageState, setPageState] = useState<ForgotPasswordState>({ kind: "idle" })
    const [formError, setFormError] = useState("")

    const handleSubmit = async (email: string) => {
        setPageState({ kind: "submitting" })
        setFormError("")
        try {
            await PasswordResetApi.request({ email })
            setPageState({ kind: "sent" })
        } catch (error) {
            setFormError(getErrorMessage(error))
            setPageState({ kind: "idle" })
        }
    }

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

                    {(pageState.kind === "idle" || pageState.kind === "submitting") && (
                        <>
                            <p className="text-center text-sm text-muted-foreground">
                                Enter your email and we&apos;ll send you a reset link.
                            </p>
                            <ForgotPasswordForm
                                initialEmail={initialEmail}
                                onSubmit={handleSubmit}
                                isSubmitting={pageState.kind === "submitting"}
                                error={formError}
                            />
                            <p className="text-center text-sm text-muted-foreground">
                                <Link href="/" className="underline hover:text-foreground">
                                    Back to sign in
                                </Link>
                            </p>
                        </>
                    )}

                    {pageState.kind === "sent" && (
                        <div className="flex flex-col items-center space-y-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                                <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-center text-sm text-muted-foreground">
                                If an account exists for that email, we&apos;ve sent a reset link to it.
                                The link expires in 30 minutes. Check your inbox (and your spam folder).
                            </p>
                            <Link
                                href="/"
                                className={cn(buttonVariants({ variant: "outline" }), "w-full")}
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
