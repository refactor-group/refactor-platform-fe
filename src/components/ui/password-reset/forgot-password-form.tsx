"use client"

import { useState, type FormEvent, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ForgotPasswordFormProps {
    initialEmail?: string
    onSubmit: (email: string) => Promise<void>
    isSubmitting: boolean
    error?: string
}

export function ForgotPasswordForm({
    initialEmail,
    onSubmit,
    isSubmitting,
    error,
}: ForgotPasswordFormProps) {
    const [email, setEmail] = useState(initialEmail ?? "")
    const [fieldError, setFieldError] = useState("")

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value)
        if (fieldError) setFieldError("")
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!email.trim()) {
            setFieldError("Email is required")
            return
        }
        await onSubmit(email.trim())
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={handleChange}
                    placeholder="name@example.com"
                    className={fieldError ? "border-red-500" : ""}
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    required
                    disabled={isSubmitting}
                />
                {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
            </div>

            {error && (
                <p className="text-center text-sm font-semibold text-red-500">{error}</p>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                    <>
                        <span className="mr-2">Sending...</span>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    </>
                ) : (
                    "Send reset link"
                )}
            </Button>
        </form>
    )
}
