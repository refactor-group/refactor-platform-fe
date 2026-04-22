"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import axios from "axios"

import { cn } from "@/components/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Icons } from "@/components/ui/icons"
import { AccountSetupForm } from "@/components/ui/setup/account-setup-form"
import { MagicLinkApi } from "@/lib/api/magic-links"
import { useLogoutUser } from "@/lib/hooks/use-logout-user"
import { siteConfig } from "@/site.config"
import type { SetupPageState } from "@/types/magic-link"

function getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status
        if (status === 404 || status === 410) {
            return "This setup link is invalid or has expired. Please contact your coach."
        }
        if (status === 409) {
            return "This account has already been set up."
        }
        if (status === 422) {
            return "Password does not meet requirements."
        }
        if (status && status >= 500) {
            return "Something went wrong. Please try again later."
        }
        if (!error.response) {
            return "Unable to connect. Please check your connection and try again."
        }
    }
    return "An unexpected error occurred. Please try again."
}

export default function SetupPage() {
    const params = useParams<{ token: string }>()
    const token = params.token
    const [pageState, setPageState] = useState<SetupPageState>({ kind: "validating" })
    const [formError, setFormError] = useState("")
    const [isSigningOut, setIsSigningOut] = useState(false)
    const logoutUser = useLogoutUser()

    const handleSignIn = async () => {
        setIsSigningOut(true)
        await logoutUser()
    }

    useEffect(() => {
        MagicLinkApi.validate(token)
            .then((user) => {
                setPageState({ kind: "ready", email: user.email })
            })
            .catch((error) => {
                setPageState({ kind: "error", message: getErrorMessage(error) })
            })
    }, [token])

    const handleSubmit = async (password: string, confirmPassword: string) => {
        if (pageState.kind !== "ready" && pageState.kind !== "submitting") return

        const email = pageState.email
        setPageState({ kind: "submitting", email })
        setFormError("")

        try {
            await MagicLinkApi.completeSetup({
                token,
                password,
                confirm_password: confirmPassword,
            })
            setPageState({ kind: "success", email })
        } catch (error) {
            setFormError(getErrorMessage(error))
            setPageState({ kind: "ready", email })
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
                                Set Up Your Account
                            </h1>
                        </div>
                    </div>

                    {pageState.kind === "validating" && (
                        <div className="flex flex-col items-center space-y-4">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                            <p className="text-sm text-muted-foreground">Validating your setup link...</p>
                        </div>
                    )}

                    {(pageState.kind === "ready" || pageState.kind === "submitting") && (
                        <>
                            <p className="text-center text-sm text-muted-foreground">
                                Create a password for <span className="font-medium">{pageState.email}</span>
                            </p>
                            <AccountSetupForm
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
                                Your account has been set up successfully. Please sign in with your new password.
                            </p>
                            <Button
                                className="w-full"
                                onClick={handleSignIn}
                                disabled={isSigningOut}
                            >
                                {isSigningOut ? (
                                    <>
                                        <span className="mr-2">Sign In</span>
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    </>
                                ) : (
                                    "Sign In"
                                )}
                            </Button>
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
                                href="/"
                                className={cn(buttonVariants({ variant: "outline" }))}
                            >
                                Go to Sign In
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}
