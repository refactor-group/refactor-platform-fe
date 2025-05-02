"use client"

import { useState, type FormEvent, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NewUserPassword } from "@/types/user"

interface PasswordUpdateFormProps {
    onSubmit: (updatedPassword: NewUserPassword) => Promise<void>
    isSubmitting: boolean
}

export function PasswordUpdateForm({ onSubmit, isSubmitting }: PasswordUpdateFormProps) {
    const [formData, setFormData] = useState<NewUserPassword>({
        current_password: "",
        new_password: "",
        confirm_password: "",
    })
    const [errors, setErrors] = useState<Record<string, string>>({})

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))

        // Clear error when user types
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

        if (!formData.current_password.trim()) {
            newErrors.current_password = "Current password is required"
        }

        if (!formData.new_password.trim()) {
            newErrors.new_password = "New password is required"
        } else if (formData.new_password.length < 8) {
            newErrors.new_password = "Password must be at least 8 characters long"
        }

        if (!formData.confirm_password.trim()) {
            newErrors.confirm_password = "Please confirm your new password"
        } else if (formData.new_password !== formData.confirm_password) {
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

        await onSubmit({ ...formData })
        setFormData({
            current_password: "",
            new_password: "",
            confirm_password: "",
        })
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="current_password">Current Password</Label>
                <Input
                    id="current_password"
                    name="current_password"
                    type="password"
                    value={formData.current_password}
                    onChange={handleChange}
                    placeholder="Enter your current password"
                    className={errors.current_password ? "border-red-500" : ""}
                    autoComplete="current-password"
                />
                {errors.current_password && <p className="text-sm text-red-500">{errors.current_password}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="new_password">New Password</Label>
                <Input
                    id="new_password"
                    name="new_password"
                    type="password"
                    value={formData.new_password}
                    onChange={handleChange}
                    placeholder="Enter your new password"
                    className={errors.new_password ? "border-red-500" : ""}
                    autoComplete="new-password"
                />
                {errors.new_password && <p className="text-sm text-red-500">{errors.new_password}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm New Password</Label>
                <Input
                    id="confirm_password"
                    name="confirm_password"
                    type="password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    placeholder="Confirm your new password"
                    className={errors.confirm_password ? "border-red-500" : ""}
                    autoComplete="new-password"
                />
                {errors.confirm_password && <p className="text-sm text-red-500">{errors.confirm_password}</p>}
            </div>

            <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <span className="mr-2">Updating...</span>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        </>
                    ) : (
                        "Update Password"
                    )}
                </Button>
            </div>
        </form>
    )
}
