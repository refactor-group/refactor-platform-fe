"use client"

import { useState, type FormEvent, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AccountSetupFormProps {
    onSubmit: (password: string, confirmPassword: string) => Promise<void>
    isSubmitting: boolean
    error: string
}

export function AccountSetupForm({ onSubmit, isSubmitting, error }: AccountSetupFormProps) {
    const [formData, setFormData] = useState({
        password: "",
        confirm_password: "",
    })
    const [errors, setErrors] = useState<Record<string, string>>({})

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))

        if (errors[name]) {
            setErrors((prev) => {
                const newErrors = { ...prev }
                delete newErrors[name]
                return newErrors
            })
        }
    }

    const validateForm = () => {
        const newErrors: Record<string, string> = {}

        if (!formData.password.trim()) {
            newErrors.password = "Password is required"
        } else if (formData.password.length < 8) {
            newErrors.password = "Password must be at least 8 characters long"
        }

        if (!formData.confirm_password.trim()) {
            newErrors.confirm_password = "Please confirm your password"
        } else if (formData.password !== formData.confirm_password) {
            newErrors.confirm_password = "Passwords do not match"
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()

        if (!validateForm()) {
            return
        }

        await onSubmit(formData.password, formData.confirm_password)
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className={errors.password ? "border-red-500" : ""}
                    autoComplete="new-password"
                    disabled={isSubmitting}
                />
                {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm Password</Label>
                <Input
                    id="confirm_password"
                    name="confirm_password"
                    type="password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    className={errors.confirm_password ? "border-red-500" : ""}
                    autoComplete="new-password"
                    disabled={isSubmitting}
                />
                {errors.confirm_password && <p className="text-sm text-red-500">{errors.confirm_password}</p>}
            </div>

            {error && (
                <p className="text-center text-sm font-semibold text-red-500">{error}</p>
            )}

            <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? (
                        <>
                            <span className="mr-2">Setting up...</span>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        </>
                    ) : (
                        "Set Password"
                    )}
                </Button>
            </div>
        </form>
    )
}
